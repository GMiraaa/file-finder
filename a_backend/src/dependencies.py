"""Dependências FastAPI reutilizáveis: usuário autenticado e data_dir."""
import asyncio
from pathlib import Path

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from src.auth import decode_access_token
from src.database import SessionLocal, User
from src.config import USERS_DATA_DIR

_bearer = HTTPBearer()


def _get_user_by_id(user_id: int) -> User | None:
    db: Session = SessionLocal()
    try:
        return db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise exc

    user = await asyncio.to_thread(_get_user_by_id, user_id)
    if user is None:
        raise exc
    return user


def get_user_data_dir(current_user: User = Depends(get_current_user)) -> Path:
    """Retorna o diretório de dados exclusivo do usuário autenticado."""
    user_dir = USERS_DATA_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir
