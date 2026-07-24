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
    owner_id        = Column(Integer, nullable=False, index=True)
    space_name      = Column(String(100), nullable=False)
    shared_with_id  = Column(Integer, nullable=False, index=True)
    permission      = Column(String(20), nullable=False, default="viewer")   # viewer | editor
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class SpaceInvite(Base):
    """Convite pendente/respondido para compartilhar um espaço."""
    __tablename__ = "space_invites"

    id             = Column(Integer, primary_key=True, index=True)
    owner_id       = Column(Integer, nullable=False, index=True)
    space_name     = Column(String(100), nullable=False)
    invitee_email  = Column(String(255), nullable=False, index=True)
    permission     = Column(String(20), nullable=False, default="viewer")    # viewer | editor
    status         = Column(String(20), nullable=False, default="pending")  # pending/accepted/declined
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


class TrashItem(Base):
    """Arquivo excluído temporariamente (soft delete — retido 30 dias)."""
    __tablename__ = "trash_items"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, nullable=False, index=True)
    filename        = Column(String(255), nullable=False)
    original_folder = Column(String(512), nullable=True)
    trash_filename  = Column(String(600), nullable=False)   # nome único no diretório .trash
    deleted_at      = Column(DateTime(timezone=True), server_default=func.now())
    expires_at      = Column(DateTime(timezone=True), nullable=False)
    size            = Column(Integer, nullable=True)
    ext             = Column(String(20), nullable=True)


class SpaceActivity(Base):
    """Log de ações realizadas em espaços compartilhados."""
    __tablename__ = "space_activity"

    id          = Column(Integer, primary_key=True, index=True)
    owner_id    = Column(Integer, nullable=False, index=True)
    space_name  = Column(String(100), nullable=False)
    actor_id    = Column(Integer, nullable=False)
    action      = Column(String(50), nullable=False)    # upload|create|delete|rename|move|create_folder
    target      = Column(String(255), nullable=False)   # nome do arquivo ou pasta
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


def create_tables() -> None:
    """Cria as tabelas se ainda não existirem."""
    Base.metadata.create_all(bind=engine)


def migrate_tables() -> None:
    """Aplica migrações manuais para colunas adicionadas a tabelas já existentes."""
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE space_shares ADD COLUMN IF NOT EXISTS permission VARCHAR(20) NOT NULL DEFAULT 'viewer'",
        "ALTER TABLE space_invites ADD COLUMN IF NOT EXISTS permission VARCHAR(20) NOT NULL DEFAULT 'viewer'",
    ]
    with engine.begin() as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass  # coluna já existe ou dialeto não suporta IF NOT EXISTS


def get_db() -> Session:
    """Retorna uma sessão do banco. Use dentro de asyncio.to_thread."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
