"""
Configuração do banco de dados com SQLAlchemy (síncrono via psycopg2).
Execução dentro de asyncio.to_thread para não bloquear o event loop.
"""
from sqlalchemy import create_engine, Column, Integer, String, DateTime, func
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from src.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(50), unique=True, nullable=False, index=True)
    email      = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


def create_tables() -> None:
    """Cria as tabelas se ainda não existirem."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """Retorna uma sessão do banco. Use dentro de asyncio.to_thread."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
