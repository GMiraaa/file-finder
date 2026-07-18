import os
from pathlib import Path

# Raiz do projeto (file-finder/)
BASE_DIR = Path(__file__).parent.parent.parent

# Diretório de dados por usuário: c_data/users/{user_id}/
USERS_DATA_DIR = BASE_DIR / "c_data" / "users"
USERS_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Compat: alias usado pelo lifespan e static files
DATA_DIR = USERS_DATA_DIR  # StaticFiles serve de c_data/users/

# Banco de dados
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://filefinder:filefinder@localhost:5432/filefinder",
)

# JWT
JWT_SECRET: str = os.getenv("JWT_SECRET", "troque-esta-chave-em-producao")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_DAYS: int = int(os.getenv("JWT_EXPIRE_DAYS", "30"))
JWT_REFRESH_EXPIRE_DAYS: int = 30

# ── Gemini Client — singleton ─────────────────────────────────────────────────
_gemini_client = None

def get_gemini_client():
    """Retorna o cliente Gemini singleton (criado na primeira chamada)."""
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        _gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _gemini_client
