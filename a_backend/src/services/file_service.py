import asyncio
import shutil
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


# ── Extratores síncronos ──────────────────────────────────────────────────────

def _read_text(path: Path) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()[:5000]


def _read_pdf(path: Path) -> str:
    import fitz
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
    return "\n".join(p.text for p in Document(str(path)).paragraphs)[:5000]


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


# ── Helpers internos ──────────────────────────────────────────────────────────

def _safe_folder(folder: str) -> Path:
    if not folder:
        return DATA_DIR
    safe = Path(folder).name
    if not safe or safe.startswith("."):
        raise ValueError("Nome de pasta inválido")
    target = DATA_DIR / safe
    if not target.is_dir():
        raise FileNotFoundError(f"Pasta não encontrada: {folder}")
    return target


def _file_stat(entry: Path, folder: str = "") -> dict:
    stat = entry.stat()
    return {
        "name": entry.name,
        "size": stat.st_size,
        "uploadedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "ext": entry.suffix.lower(),
        "folder": folder or None,
    }


# ── API pública ───────────────────────────────────────────────────────────────

async def get_items(folder: str = "") -> dict:
    target = _safe_folder(folder)
    files, folders = [], []
    entries = sorted(target.iterdir(), key=lambda e: e.stat().st_mtime, reverse=True)
    for entry in entries:
        if entry.name.startswith("."):
            continue
        if entry.is_dir() and not folder:
            count = sum(1 for f in entry.iterdir() if f.is_file() and not f.name.startswith("."))
            folders.append({
                "name": entry.name,
                "fileCount": count,
                "createdAt": datetime.fromtimestamp(entry.stat().st_mtime, tz=timezone.utc).isoformat(),
            })
        elif entry.is_file():
            files.append(_file_stat(entry, folder))
    return {"files": files, "folders": folders}


async def get_all_files_flat() -> list[dict]:
    result = []
    for entry in DATA_DIR.rglob("*"):
        if not entry.is_file() or entry.name.startswith("."):
            continue
        rel = entry.relative_to(DATA_DIR)
        folder = str(rel.parent) if str(rel.parent) != "." else ""
        result.append(_file_stat(entry, folder))
    return sorted(result, key=lambda f: f["uploadedAt"], reverse=True)


async def get_files_with_content() -> list[dict]:
    result = []
    for entry in DATA_DIR.rglob("*"):
        if not entry.is_file() or entry.name.startswith("."):
            continue
        rel = entry.relative_to(DATA_DIR)
        folder = str(rel.parent) if str(rel.parent) != "." else ""
        content = await extract_content(entry)
        result.append({**_file_stat(entry, folder), "content": content})
    return result


async def create_folder(name: str) -> None:
    safe = Path(name).name
    if not safe or safe.startswith("."):
        raise ValueError("Nome de pasta inválido")
    path = DATA_DIR / safe
    if path.exists():
        raise ValueError(f"Pasta '{safe}' já existe")
    await asyncio.to_thread(path.mkdir)


async def delete_folder(name: str) -> None:
    safe = Path(name).name
    path = DATA_DIR / safe
    if not str(path).startswith(str(DATA_DIR)):
        raise PermissionError("Acesso negado")
    if not path.is_dir():
        raise FileNotFoundError(f"Pasta não encontrada: {name}")
    await asyncio.to_thread(shutil.rmtree, path)


async def move_file(filename: str, from_folder: str, to_folder: str) -> None:
    safe_file = Path(filename).name
    src_dir = _safe_folder(from_folder)
    dst_dir = _safe_folder(to_folder)
    src = src_dir / safe_file
    if not src.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    dst = dst_dir / safe_file
    if dst.exists():
        raise ValueError("Já existe um arquivo com este nome na pasta destino")
    await asyncio.to_thread(src.rename, dst)


async def delete_file(filename: str, folder: str = "") -> None:
    safe_file = Path(filename).name
    if not safe_file or safe_file.startswith("."):
        raise ValueError("Nome de arquivo inválido")
    target_dir = _safe_folder(folder)
    file_path = target_dir / safe_file
    if not str(file_path).startswith(str(DATA_DIR)):
        raise PermissionError("Acesso negado")
    if not file_path.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    await asyncio.to_thread(file_path.unlink)
