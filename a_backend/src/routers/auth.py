import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from src.auth import hash_password, verify_password, create_access_token
from src.database import SessionLocal, User
from src.config import USERS_DATA_DIR

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
    username: str   # pode ser username ou e-mail
    password: str


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
    """Cria o diretório do usuário com espaço 'Geral' padrão."""
    user_dir = USERS_DATA_DIR / str(user_id)
    (user_dir / "Geral").mkdir(parents=True, exist_ok=True)


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

    token = create_access_token(user.id, user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email},
    }


@router.post("/login")
async def login(body: LoginRequest):
    user = await asyncio.to_thread(_find_user, body.username)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    token = create_access_token(user.id, user.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "email": user.email},
    }


@router.get("/me")
async def me(credentials=None):
    # Dependency injetada via router config em main.py
    pass
