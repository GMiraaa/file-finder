"""
Router para gerenciamento de espaços compartilhados e convites.

Endpoints (prefixo /api/spaces):
  GET  /shared                          — espaços compartilhados comigo
  GET  /invites                         — convites pendentes para mim
  POST /invites/{id}/accept             — aceitar convite
  POST /invites/{id}/decline            — recusar convite
  POST /{space_name}/invite             — convidar usuário (dono apenas)
  GET  /{space_name}/members            — membros + convites pendentes (dono apenas)
  DELETE /{space_name}/members/{uid}    — remover membro (dono apenas)
  DELETE /{space_name}/invites/{iid}    — cancelar convite pendente (dono apenas)
"""

import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.config import USERS_DATA_DIR
from src.database import SessionLocal, User, SpaceInvite, SpaceShare
from src.dependencies import get_current_user, get_user_data_dir

router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

def _db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _verify_owns_space(space_name: str, data_dir: Path) -> None:
    """Lança 404 se o espaço não existir no diretório do usuário autenticado."""
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


# ── GET /shared ───────────────────────────────────────────────────────────────

@router.get("/shared")
async def get_shared_spaces(current_user: User = Depends(get_current_user)):
    """Retorna todos os espaços que outros usuários compartilharam com o usuário atual."""
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
    """Retorna convites pendentes endereçados ao e-mail do usuário atual."""
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
                    "created_at":     inv.created_at.isoformat() if inv.created_at else None,
                })
            return result
        finally:
            db.close()

    invites = await asyncio.to_thread(_query)
    return {"invites": invites}


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

            # Garante que o espaço ainda existe
            space_path = USERS_DATA_DIR / str(invite.owner_id) / invite.space_name
            if not space_path.is_dir():
                raise HTTPException(status_code=410, detail="O espaço compartilhado não existe mais.")

            # Evita duplicata em SpaceShare
            existing = db.query(SpaceShare).filter_by(
                owner_id=invite.owner_id,
                space_name=invite.space_name,
                shared_with_id=current_user.id,
            ).first()
            if not existing:
                db.add(SpaceShare(
                    owner_id=invite.owner_id,
                    space_name=invite.space_name,
                    shared_with_id=current_user.id,
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

    def _invite():
        db = SessionLocal()
        try:
            invitee = db.query(User).filter_by(email=body.email).first()
            if not invitee:
                raise HTTPException(status_code=404, detail="Nenhum usuário encontrado com este e-mail.")
            if invitee.id == current_user.id:
                raise HTTPException(status_code=400, detail="Você não pode se convidar para o próprio espaço.")

            # Já tem acesso?
            existing_share = db.query(SpaceShare).filter_by(
                owner_id=current_user.id, space_name=space_name, shared_with_id=invitee.id
            ).first()
            if existing_share:
                raise HTTPException(status_code=409, detail="Este usuário já tem acesso a este espaço.")

            # Convite pendente?
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
            ))
            db.commit()
        finally:
            db.close()

    await asyncio.to_thread(_invite)
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
                        "id":       u.id,
                        "username": u.username,
                        "email":    u.email,
                    })

            pending = db.query(SpaceInvite).filter_by(
                owner_id=current_user.id, space_name=space_name, status="pending"
            ).all()
            pending_list = [{"invite_id": inv.id, "email": inv.invitee_email} for inv in pending]

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
