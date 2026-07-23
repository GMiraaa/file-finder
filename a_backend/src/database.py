"""
Configuração do banco de dados com SQLAlchemy (síncrono via psycopg2).
Execução dentro de asyncio.to_thread para não bloquear o event loop.
"""
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, func
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


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    user_id    = Column(Integer, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked    = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, nullable=False, index=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    message     = Column(Text, nullable=False)          # prompt do usuário
    result      = Column(Text, nullable=True)           # resposta final do agente
    actions     = Column(Text, nullable=True)           # JSON list de ações executadas
    was_undone  = Column(Boolean, default=False, nullable=False)


class SpaceShare(Base):
    """Registro de acesso concedido a um espaço — criado ao aceitar um convite."""
    __tablename__ = "space_shares"

    id              = Column(Integer, primary_key=True, index=True)
    owner_id        = Column(Integer, nullable=False, index=True)   # dono do espaço
    space_name      = Column(String(100), nullable=False)
    shared_with_id  = Column(Integer, nullable=False, index=True)   # quem recebeu acesso
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class SpaceInvite(Base):
    """Convite pendente/respondido para compartilhar um espaço."""
    __tablename__ = "space_invites"

    id             = Column(Integer, primary_key=True, index=True)
    owner_id       = Column(Integer, nullable=False, index=True)
    space_name     = Column(String(100), nullable=False)
    invitee_email  = Column(String(255), nullable=False, index=True)
    status         = Column(String(20), nullable=False, default="pending")  # pending/accepted/declined
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


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
