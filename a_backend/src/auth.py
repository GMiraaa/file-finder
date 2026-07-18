"""Utilitários de autenticação: hashing de senha, JWT e refresh tokens."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from src.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_DAYS, JWT_REFRESH_EXPIRE_DAYS


# ── Senha ─────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT (access token, curta duração) ────────────────────────────────────────

def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "username": username, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises JWTError if invalid or expired."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ── Refresh token ─────────────────────────────────────────────────────────────

def generate_refresh_token() -> str:
    """Gera um refresh token aleatório seguro (64 hex chars)."""
    return secrets.token_hex(32)


def hash_refresh_token(token: str) -> str:
    """Armazena apenas o hash SHA-256 no banco."""
    return hashlib.sha256(token.encode()).hexdigest()


def refresh_token_expires() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_EXPIRE_DAYS)
