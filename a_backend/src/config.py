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
