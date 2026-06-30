from pathlib import Path

# Raiz do projeto (file-finder/)
BASE_DIR = Path(__file__).parent.parent.parent

DATA_DIR = BASE_DIR / "c_data"
DATA_DIR.mkdir(exist_ok=True)
