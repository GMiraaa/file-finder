import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

from src.config import USERS_DATA_DIR
from src.database import create_tables
from src.routers import files, search, chat, insights
from src.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria tabelas do banco na inicialização (sem apagar dados existentes)
    try:
        create_tables()
    except Exception as e:
        print(f"[startup] Aviso ao criar tabelas: {e}")
    yield


app = FastAPI(title="FileFinder API", version="3.0.0", redirect_slashes=False, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Servir arquivos dos usuários: /files/{user_id}/...
app.mount("/files", StaticFiles(directory=str(USERS_DATA_DIR)), name="files")

app.include_router(auth.router,    prefix="/api/auth")
app.include_router(files.router,   prefix="/api/files")
app.include_router(search.router,  prefix="/api/search")
app.include_router(chat.router,    prefix="/api/chat")
app.include_router(insights.router, prefix="/api/insights")
