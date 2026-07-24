import asyncio
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from src.auth import (
    hash_password, verify_password, create_access_token,
    generate_refresh_token, hash_refresh_token, refresh_token_expires,
)
from src.database import SessionLocal, User, RefreshToken, SpaceShare, SpaceInvite
from src.config import USERS_DATA_DIR
from src.limiter import limiter
from src.dependencies import get_current_user

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Nome de usuário deve ter entre 3 e 50 caracteres.")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Nome de usuário só pode conter letras, números, _ e -.")
        return v

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A senha deve ter ao menos 6 caracteres.")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Helpers síncronos (executados em thread) ──────────────────────────────────

def _find_user(username_or_email: str) -> User | None:
    db: Session = SessionLocal()
    try:
        return (
            db.query(User)
            .filter(
                (User.username == username_or_email)
                | (User.email == username_or_email)
            )
            .first()
        )
    finally:
        db.close()


def _find_user_by_id(user_id: int) -> User | None:
    db: Session = SessionLocal()
    try:
        return db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()


def _create_user(username: str, email: str, password_hash: str) -> User:
    db: Session = SessionLocal()
    try:
        user = User(username=username, email=email, password_hash=password_hash)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def _init_user_dir(user_id: int) -> None:
    user_dir = USERS_DATA_DIR / str(user_id)
    (user_dir / "Geral").mkdir(parents=True, exist_ok=True)


def _save_refresh_token(user_id: int, token_hash: str, expires_at: datetime) -> None:
    db: Session = SessionLocal()
    try:
        rt = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        db.add(rt)
        db.commit()
    finally:
        db.close()


def _consume_refresh_token(token_hash: str):
    """Valida e revoga o refresh token. Retorna user_id ou None."""
    db: Session = SessionLocal()
    try:
        rt = db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        ).first()
        if rt is None:
            return None
        now = datetime.utcnow().replace(tzinfo=rt.expires_at.tzinfo)
        if rt.expires_at < now:
            return None
        rt.revoked = True
        db.commit()
        return rt.user_id
    finally:
        db.close()


def _auth_response(user: User):
    access_token = create_access_token(user.id, user.username)
    raw_refresh   = generate_refresh_token()
    rt_hash       = hash_refresh_token(raw_refresh)
    rt_expires    = refresh_token_expires()
    _save_refresh_token(user.id, rt_hash, rt_expires)
    return {
        "access_token":  access_token,
        "refresh_token": raw_refresh,
        "token_type":    "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email},
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    existing = await asyncio.to_thread(_find_user, body.username)
    if existing:
        raise HTTPException(status_code=409, detail="Nome de usuário já em uso.")
    existing_email = await asyncio.to_thread(_find_user, body.email)
    if existing_email:
        raise HTTPException(status_code=409, detail="E-mail já cadastrado.")

    password_hash = hash_password(body.password)
    user = await asyncio.to_thread(_create_user, body.username, body.email, password_hash)
    await asyncio.to_thread(_init_user_dir, user.id)
    return _auth_response(user)


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest):
    user = await asyncio.to_thread(_find_user, body.username)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha incorretos.")
    return _auth_response(user)


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    """Troca um refresh token válido por novos access + refresh tokens (rotação)."""
    rt_hash = hash_refresh_token(body.refresh_token)
    user_id = await asyncio.to_thread(_consume_refresh_token, rt_hash)
    if not user_id:
        raise HTTPException(status_code=401, detail="Refresh token inválido ou expirado.")
    user = await asyncio.to_thread(_find_user_by_id, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")
    return _auth_response(user)


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email}


# ── Schemas de perfil ─────────────────────────────────────────────────────────

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Nome de usuário deve ter entre 3 e 50 caracteres.")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Nome de usuário só pode conter letras, números, _ e -.")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A nova senha deve ter ao menos 6 caracteres.")
        return v


class DeleteAccountRequest(BaseModel):
    password: str


# ── PUT /profile ──────────────────────────────────────────────────────────────

@router.put("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
):
    if body.username is None and body.email is None:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")

    def _update():
        db: Session = SessionLocal()
        try:
            user = db.query(User).filter(User.id == current_user.id).first()
            if not user:
                raise HTTPException(status_code=404, detail="Usuário não encontrado.")

            if body.username and body.username != user.username:
                conflict = db.query(User).filter(
                    User.username == body.username, User.id != current_user.id
                ).first()
                if conflict:
                    raise HTTPException(status_code=409, detail="Nome de usuário já em uso.")
                user.username = body.username

            if body.email and body.email != user.email:
                conflict = db.query(User).filter(
                    User.email == body.email, User.id != current_user.id
                ).first()
                if conflict:
                    raise HTTPException(status_code=409, detail="E-mail já cadastrado.")
                user.email = body.email

            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()

    user = await asyncio.to_thread(_update)
    return _auth_response(user)


# ── PUT /password ─────────────────────────────────────────────────────────────

@router.put("/password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    def _update():
        db: Session = SessionLocal()
        try:
            user = db.query(User).filter(User.id == current_user.id).first()
            if not user:
                raise HTTPException(status_code=404, detail="Usuário não encontrado.")
            if not verify_password(body.current_password, user.password_hash):
                raise HTTPException(status_code=400, detail="Senha atual incorreta.")
            user.password_hash = hash_password(body.new_password)
            # Revoga todos os refresh tokens existentes
            db.query(RefreshToken).filter(
                RefreshToken.user_id == user.id, RefreshToken.revoked == False
            ).update({"revoked": True}, synchronize_session=False)
            db.commit()
            db.refresh(user)
            return user
        finally:
            db.close()

    user = await asyncio.to_thread(_update)
    return _auth_response(user)


# ── DELETE /account ───────────────────────────────────────────────────────────

@router.delete("/account", status_code=status.HTTP_200_OK)
async def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
):
    def _delete():
        db: Session = SessionLocal()
        try:
            user = db.query(User).filter(User.id == current_user.id).first()
            if not user:
                raise HTTPException(status_code=404, detail="Usuário não encontrado.")
            if not verify_password(body.password, user.password_hash):
                raise HTTPException(status_code=400, detail="Senha incorreta.")

            # Remove dados relacionados
            db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete(synchronize_session=False)
            db.query(SpaceShare).filter(
                (SpaceShare.owner_id == user.id) | (SpaceShare.shared_with_id == user.id)
            ).delete(synchronize_session=False)
            db.query(SpaceInvite).filter(SpaceInvite.owner_id == user.id).delete(synchronize_session=False)
            db.delete(user)
            db.commit()
        finally:
            db.close()

    await asyncio.to_thread(_delete)

    user_dir = USERS_DATA_DIR / str(current_user.id)
    if user_dir.is_dir():
        await asyncio.to_thread(shutil.rmtree, user_dir)

    return {"message": "Conta excluída com sucesso."}

