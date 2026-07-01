import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

# Importar config antes de montar StaticFiles garante que DATA_DIR existe
from src.config import DATA_DIR
from src.routers import files, search, chat, insights

app = FastAPI(title="FileFinder API", version="2.0.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Servir arquivos enviados como assets estáticos
app.mount("/files", StaticFiles(directory=str(DATA_DIR)), name="files")

app.include_router(files.router, prefix="/api/files")
app.include_router(search.router, prefix="/api/search")
app.include_router(chat.router, prefix="/api/chat")
app.include_router(insights.router, prefix="/api/insights")
