import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from src.config import DATA_DIR

TEXT_EXTENSIONS = {
    ".txt", ".md", ".json", ".csv", ".html", ".xml", ".js", ".ts",
    ".jsx", ".tsx", ".py", ".java", ".c", ".cpp", ".h", ".hpp",
    ".css", ".scss", ".sass", ".yaml", ".yml", ".sh", ".bash",
    ".sql", ".log", ".env", ".ini", ".toml", ".conf", ".cfg",
    ".r", ".rb", ".php", ".go", ".rs", ".kt", ".swift",
}


# ── Leitores síncronos (executados em thread para não bloquear o event loop) ──

def _read_text(path: Path) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()[:5000]


def _read_pdf(path: Path) -> str:
    import fitz  # PyMuPDF
    doc = fitz.open(str(path))
    text = ""
    for page in doc:
        text += page.get_text()
        if len(text) >= 5000:
            break
    doc.close()
    return text[:5000]


def _read_docx(path: Path) -> str:
    from docx import Document
    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs)[:5000]


# ── Interface assíncrona ───────────────────────────────────────────────────────

async def extract_content(file_path: Path) -> Optional[str]:
    ext = file_path.suffix.lower()
    try:
        if ext in TEXT_EXTENSIONS:
            return await asyncio.to_thread(_read_text, file_path)
        if ext == ".pdf":
            return await asyncio.to_thread(_read_pdf, file_path)
        if ext == ".docx":
            return await asyncio.to_thread(_read_docx, file_path)
    except Exception as e:
        print(f"[file_service] Erro ao extrair '{file_path.name}': {e}")
    return None


async def get_all_files() -> list[dict]:
    DATA_DIR.mkdir(exist_ok=True)
    entries = [e for e in DATA_DIR.iterdir() if e.is_file() and not e.name.startswith(".")]
    entries.sort(key=lambda e: e.stat().st_mtime, reverse=True)

    return [
        {
            "name": e.name,
            "size": e.stat().st_size,
            "uploadedAt": datetime.fromtimestamp(e.stat().st_mtime, tz=timezone.utc).isoformat(),
            "ext": e.suffix.lower(),
        }
        for e in entries
    ]


async def delete_file(filename: str) -> None:
    # Previne path traversal
    safe_name = Path(filename).name
    if not safe_name or safe_name.startswith("."):
        raise ValueError("Nome de arquivo inválido")

    file_path = DATA_DIR / safe_name

    if not str(file_path).startswith(str(DATA_DIR)):
        raise PermissionError("Acesso negado")

    if not file_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_name}")

    await asyncio.to_thread(file_path.unlink)


async def get_files_with_content() -> list[dict]:
    files = await get_all_files()
    results = []
    for f in files:
        content = await extract_content(DATA_DIR / f["name"])
        results.append({**f, "content": content})
    return results
