"""
Router para gerenciamento de espaços compartilhados, convites e SSE de notificações.

Endpoints (prefixo /api/spaces):
  GET  /shared                          — espaços compartilhados comigo
  GET  /invites                         — convites pendentes para mim
  GET  /invites/stream                  — SSE: stream de novos convites em tempo real
  POST /invites/{id}/accept             — aceitar convite
  POST /invites/{id}/decline            — recusar convite
  POST /{space_name}/invite             — convidar usuário (dono apenas)
  GET  /{space_name}/members            — membros + convites pendentes (dono apenas)
  DELETE /{space_name}/members/{uid}    — remover membro (dono apenas)
  DELETE /{space_name}/invites/{iid}    — cancelar convite pendente (dono apenas)
"""

import asyncio
import json
from pathlib import Path
from typing import Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from pydantic import BaseModel

from src.auth import decode_access_token
from src.config import USERS_DATA_DIR
from src.database import SessionLocal, User, SpaceInvite, SpaceShare, SpaceActivity
from src.dependencies import get_current_user, get_user_data_dir

router = APIRouter()

# ── SSE: registro de conexões por user_id ─────────────────────────────────────
_invite_queues: Dict[int, asyncio.Queue] = {}
_bearer_optional = HTTPBearer(auto_error=False)


# ── helpers ──────────────────────────────────────────────────────────────────

def _verify_owns_space(space_name: str, data_dir: Path) -> None:
    space_path = (data_dir / space_name).resolve()
    if not space_path.is_relative_to(data_dir.resolve()) or not space_path.is_dir():
        raise HTTPException(status_code=404, detail="Espaço não encontrado.")


def _count_files(path: Path) -> int:
    if not path.is_dir():
        return 0
    return sum(1 for f in path.rglob("*") if f.is_file() and not f.name.startswith("."))


# ── modelos de request ────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str
    permission: Literal["viewer", "editor"] = "viewer"


# ── GET /shared ───────────────────────────────────────────────────────────────

@router.get("/shared")
async def get_shared_spaces(current_user: User = Depends(get_current_user)):
    def _query():
        db = SessionLocal()
        try:
            shares = db.query(SpaceShare).filter_by(shared_with_id=current_user.id).all()
            result = []
            for share in shares:
                owner = db.query(User).filter_by(id=share.owner_id).first()
                if not owner:
                    continue
                space_path = USERS_DATA_DIR / str(owner.id) / share.space_name
                result.append({
                    "space_name":      share.space_name,
                    "owner_id":        owner.id,
                    "owner_username":  owner.username,
                    "permission":      share.permission,
                    "file_count":      _count_files(space_path),
                })
            return result
        finally:
            db.close()

    shared = await asyncio.to_thread(_query)
    return {"shared_spaces": shared}


# ── GET /invites ──────────────────────────────────────────────────────────────

@router.get("/invites")
async def get_my_invites(current_user: User = Depends(get_current_user)):
    def _query():
        db = SessionLocal()
        try:
            invites = (
                db.query(SpaceInvite)
                .filter_by(invitee_email=current_user.email, status="pending")
                .all()
            )
            result = []
            for inv in invites:
                owner = db.query(User).filter_by(id=inv.owner_id).first()
                result.append({
                    "id":             inv.id,
                    "space_name":     inv.space_name,
                    "owner_id":       inv.owner_id,
                    "owner_username": owner.username if owner else "Usuário desconhecido",
                    "permission":     inv.permission,
                    "created_at":     inv.created_at.isoformat() if inv.created_at else None,
                })
            return result
        finally:
            db.close()

    invites = await asyncio.to_thread(_query)
    return {"invites": invites}


# ── GET /invites/stream (SSE) ─────────────────────────────────────────────────

@router.get("/invites/stream")
async def invite_stream(
    token: Optional[str] = Query(default=None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional),
):
    """SSE stream de notificações de novos convites em tempo real."""
    raw_token = (credentials.credentials if credentials else None) or token
    if not raw_token:
        raise HTTPException(status_code=401, detail="Token obrigatório.")

    try:
        payload = decode_access_token(raw_token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido.")

    queue: asyncio.Queue = asyncio.Queue()
    _invite_queues[user_id] = queue

    async def generate():
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        finally:
            _invite_queues.pop(user_id, None)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── POST /invites/{id}/accept ─────────────────────────────────────────────────

@router.post("/invites/{invite_id}/accept")
async def accept_invite(invite_id: int, current_user: User = Depends(get_current_user)):
    def _accept():
        db = SessionLocal()
        try:
            invite = (
                db.query(SpaceInvite)
                .filter_by(id=invite_id, invitee_email=current_user.email, status="pending")
                .first()
            )
            if not invite:
                raise HTTPException(status_code=404, detail="Convite não encontrado.")

            space_path = USERS_DATA_DIR / str(invite.owner_id) / invite.space_name
            if not space_path.is_dir():
                raise HTTPException(status_code=410, detail="O espaço compartilhado não existe mais.")

            existing = db.query(SpaceShare).filter_by(
                owner_id=invite.owner_id, space_name=invite.space_name,
                shared_with_id=current_user.id,
            ).first()
            if not existing:
                db.add(SpaceShare(
                    owner_id=invite.owner_id,
                    space_name=invite.space_name,
                    shared_with_id=current_user.id,
                    permission=invite.permission,
                ))

            invite.status = "accepted"
            db.commit()
            return {"space_name": invite.space_name, "owner_id": invite.owner_id}
        finally:
            db.close()

    result = await asyncio.to_thread(_accept)
    return {"message": "Convite aceito com sucesso.", **result}


# ── POST /invites/{id}/decline ────────────────────────────────────────────────

@router.post("/invites/{invite_id}/decline")
async def decline_invite(invite_id: int, current_user: User = Depends(get_current_user)):
    def _decline():
        db = SessionLocal()
        try:
            invite = (
                db.query(SpaceInvite)
                .filter_by(id=invite_id, invitee_email=current_user.email, status="pending")
                .first()
            )
            if not invite:
                raise HTTPException(status_code=404, detail="Convite não encontrado.")
            invite.status = "declined"
            db.commit()
        finally:
            db.close()

    await asyncio.to_thread(_decline)
    return {"message": "Convite recusado."}


# ── POST /{space_name}/invite ─────────────────────────────────────────────────

@router.post("/{space_name}/invite")
async def invite_user(
    space_name: str,
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    _verify_owns_space(space_name, data_dir)

    def _invite() -> Optional[int]:
        db = SessionLocal()
        try:
            invitee = db.query(User).filter_by(email=body.email).first()
            if not invitee:
                raise HTTPException(status_code=404, detail="Nenhum usuário encontrado com este e-mail.")
            if invitee.id == current_user.id:
                raise HTTPException(status_code=400, detail="Você não pode se convidar para o próprio espaço.")

            existing_share = db.query(SpaceShare).filter_by(
                owner_id=current_user.id, space_name=space_name, shared_with_id=invitee.id
            ).first()
            if existing_share:
                raise HTTPException(status_code=409, detail="Este usuário já tem acesso a este espaço.")

            existing_invite = db.query(SpaceInvite).filter_by(
                owner_id=current_user.id, space_name=space_name,
                invitee_email=body.email, status="pending",
            ).first()
            if existing_invite:
                raise HTTPException(status_code=409, detail="Já existe um convite pendente para este e-mail.")

            db.add(SpaceInvite(
                owner_id=current_user.id,
                space_name=space_name,
                invitee_email=body.email,
                permission=body.permission,
            ))
            db.commit()
            return invitee.id
        finally:
            db.close()

    invitee_id = await asyncio.to_thread(_invite)

    # Notificar via SSE se o convidado estiver conectado
    if invitee_id and invitee_id in _invite_queues:
        await _invite_queues[invitee_id].put({
            "type":           "new_invite",
            "space_name":     space_name,
            "owner_username": current_user.username,
            "permission":     body.permission,
        })

    return {"message": "Convite enviado com sucesso."}


# ── GET /{space_name}/members ─────────────────────────────────────────────────

@router.get("/{space_name}/members")
async def get_space_members(
    space_name: str,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    _verify_owns_space(space_name, data_dir)

    def _query():
        db = SessionLocal()
        try:
            shares = db.query(SpaceShare).filter_by(
                owner_id=current_user.id, space_name=space_name
            ).all()
            members = []
            for share in shares:
                u = db.query(User).filter_by(id=share.shared_with_id).first()
                if u:
                    members.append({
                        "id":         u.id,
                        "username":   u.username,
                        "email":      u.email,
                        "permission": share.permission,
                    })

            pending = db.query(SpaceInvite).filter_by(
                owner_id=current_user.id, space_name=space_name, status="pending"
            ).all()
            pending_list = [
                {"invite_id": inv.id, "email": inv.invitee_email, "permission": inv.permission}
                for inv in pending
            ]

            return {"members": members, "pending_invites": pending_list}
        finally:
            db.close()

    return await asyncio.to_thread(_query)


# ── DELETE /{space_name}/members/{member_id} ──────────────────────────────────

@router.delete("/{space_name}/members/{member_id}")
async def remove_member(
    space_name: str,
    member_id: int,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    _verify_owns_space(space_name, data_dir)

    def _remove():
        db = SessionLocal()
        try:
            share = db.query(SpaceShare).filter_by(
                owner_id=current_user.id, space_name=space_name, shared_with_id=member_id
            ).first()
            if not share:
                raise HTTPException(status_code=404, detail="Membro não encontrado.")
            db.delete(share)
            db.commit()
        finally:
            db.close()

    await asyncio.to_thread(_remove)
    return {"message": "Membro removido com sucesso."}


# ── DELETE /{space_name}/invites/{invite_id} ──────────────────────────────────

@router.delete("/{space_name}/invites/{invite_id}")
async def cancel_invite(
    space_name: str,
    invite_id: int,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    _verify_owns_space(space_name, data_dir)

    def _cancel():
        db = SessionLocal()
        try:
            invite = db.query(SpaceInvite).filter_by(
                id=invite_id, owner_id=current_user.id, space_name=space_name, status="pending"
            ).first()
            if not invite:
                raise HTTPException(status_code=404, detail="Convite não encontrado.")
            db.delete(invite)
            db.commit()
        finally:
            db.close()

    await asyncio.to_thread(_cancel)
    return {"message": "Convite cancelado."}


# ── PATCH /{space_name}/members/{member_id} ───────────────────────────────────

class UpdatePermissionRequest(BaseModel):
    permission: Literal["viewer", "editor"]


@router.patch("/{space_name}/members/{member_id}")
async def update_member_permission(
    space_name: str,
    member_id: int,
    body: UpdatePermissionRequest,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    _verify_owns_space(space_name, data_dir)

    def _update():
        db = SessionLocal()
        try:
            share = db.query(SpaceShare).filter_by(
                owner_id=current_user.id, space_name=space_name, shared_with_id=member_id
            ).first()
            if not share:
                raise HTTPException(status_code=404, detail="Membro não encontrado.")
            share.permission = body.permission
            db.commit()
        finally:
            db.close()

    await asyncio.to_thread(_update)
    return {"message": "Permissão atualizada com sucesso."}


# ── GET /{space_name}/activity ─────────────────────────────────────────────

@router.get("/{space_name}/activity")
async def get_space_activity(
    space_name: str,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    """Retorna as últimas 50 ações realizadas em um espaço compartilhado."""
    _verify_owns_space(space_name, data_dir)

    def _query():
        db = SessionLocal()
        try:
            logs = (
                db.query(SpaceActivity)
                .filter_by(owner_id=current_user.id, space_name=space_name)
                .order_by(SpaceActivity.created_at.desc())
                .limit(50)
                .all()
            )
            result = []
            for log in logs:
                actor = db.query(User).filter_by(id=log.actor_id).first()
                result.append({
                    "id":             log.id,
                    "actor_username": actor.username if actor else "Usuário desconhecido",
                    "action":         log.action,
                    "target":         log.target,
                    "created_at":     log.created_at.isoformat() if log.created_at else None,
                })
            return result
        finally:
            db.close()

    activity = await asyncio.to_thread(_query)
    return {"activity": activity}
