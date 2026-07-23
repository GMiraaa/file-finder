import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

load_dotenv()

from src.config import USERS_DATA_DIR
from src.database import create_tables, migrate_tables
from src.limiter import limiter
from src.routers import files, search, chat, insights
from src.routers import auth
from src.routers import agent
from src.routers import spaces


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria tabelas do banco na inicialização (sem apagar dados existentes)
    try:
        create_tables()
        migrate_tables()
    except Exception as e:
        print(f"[startup] Aviso ao criar/migrar tabelas: {e}")
    yield


app = FastAPI(title="FileFinder API", version="3.0.0", redirect_slashes=False, lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Nota: arquivos servidos via /api/files/serve/{user_id}/{path} com validação JWT

app.include_router(auth.router,     prefix="/api/auth")
app.include_router(files.router,    prefix="/api/files")
app.include_router(search.router,   prefix="/api/search")
app.include_router(chat.router,     prefix="/api/chat")
app.include_router(insights.router, prefix="/api/insights")
app.include_router(agent.router,    prefix="/api/agent")
app.include_router(spaces.router,   prefix="/api/spaces")
