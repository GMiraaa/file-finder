import asyncio
import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from src.config import DATA_DIR

# ── Segurança: extensões e bytes proibidos ────────────────────────────────────

BLOCKED_EXTENSIONS: frozenset[str] = frozenset({
    # Executáveis Windows
    ".exe", ".dll", ".bat", ".cmd", ".com", ".pif", ".scr", ".msi",
    # Scripts Windows
    ".vbs", ".vbe", ".ps1", ".psm1", ".psd1",
    # Bytecode JVM / pacotes Java
    ".jar", ".class", ".war", ".ear",
    # Pacotes/instaladores macOS / Linux / Mobile
    ".app", ".dmg", ".deb", ".rpm", ".pkg", ".apk", ".ipa",
})

# Bytes mágicos de formatos executáveis — bloqueados independente da extensão
_DANGEROUS_MAGIC: list[tuple[bytes, str]] = [
    (b"MZ",                "executável Windows (PE)"),
    (b"\x7fELF",           "executável Linux/Unix (ELF)"),
    (b"\xca\xfe\xba\xbe",  "executável macOS (Mach-O fat)"),
    (b"\xfe\xed\xfa\xce",  "executável macOS (Mach-O 32-bit)"),
    (b"\xfe\xed\xfa\xcf",  "executável macOS (Mach-O 64-bit)"),
    (b"\xce\xfa\xed\xfe",  "executável macOS (Mach-O LE 32-bit)"),
    (b"\xcf\xfa\xed\xfe",  "executável macOS (Mach-O LE 64-bit)"),
]

# Para extensões de imagem/documento, valida que o conteúdo corresponde ao tipo
_EXPECTED_MAGIC: dict[str, list[bytes]] = {
    ".pdf":  [b"%PDF"],
    ".png":  [b"\x89PNG\r\n\x1a\n"],
    ".jpg":  [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".gif":  [b"GIF87a", b"GIF89a"],
    ".webp": [b"RIFF"],
    ".bmp":  [b"BM"],
    ".ico":  [b"\x00\x00\x01\x00"],
}


def check_file_safety(filename: str, content: bytes) -> None:
    """
    Valida segurança do conteúdo do arquivo.
    Raises ValueError com mensagem descritiva se rejeitado.
    """
    ext = Path(filename).suffix.lower()

    # 1. Extensão proibida
    if ext in BLOCKED_EXTENSIONS:
        raise ValueError(
            f"Tipo de arquivo '{ext}' não é permitido por razões de segurança."
        )

    # 2. Bytes mágicos de executáveis (detecta executáveis renomeados)
    header = content[:8]
    for magic, label in _DANGEROUS_MAGIC:
        if header[: len(magic)] == magic:
            raise ValueError(
                f"Arquivo rejeitado: conteúdo identificado como {label.decode()}. "
                "Executáveis não são permitidos independente da extensão."
            )

    # 3. Validação de integridade para imagens e PDFs declarados
    if ext in _EXPECTED_MAGIC:
        expected_list = _EXPECTED_MAGIC[ext]
        is_valid = any(header[: len(m)].startswith(m) for m in expected_list)
        if not is_valid:
            raise ValueError(
                f"O conteúdo do arquivo não corresponde à extensão '{ext}'. "
                "Verifique se o arquivo está íntegro ou com extensão correta."
            )


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

def _safe_dir(folder: str) -> Path:
    """Resolve um caminho relativo dentro de DATA_DIR, com proteção contra path traversal.
    Suporta caminhos aninhados como 'Financeiro/Relatorios' (máx. 2 níveis).
    """
    if not folder:
        return DATA_DIR
    # Resolve and validate to prevent path traversal
    target = (DATA_DIR / folder).resolve()
    if not target.is_relative_to(DATA_DIR.resolve()):
        raise PermissionError("Acesso negado")
    # Limit depth to 2 levels (space/subfolder)
    rel = target.relative_to(DATA_DIR.resolve())
    if len(rel.parts) > 2:
        raise ValueError("Máximo 2 níveis de pasta suportados")
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
    target = _safe_dir(folder)
    # Determine depth to decide whether to show subfolders
    rel = target.resolve().relative_to(DATA_DIR.resolve())
    depth = len(rel.parts)  # 0 = root, 1 = space, 2 = subfolder

    files, folders = [], []
    entries = sorted(target.iterdir(), key=lambda e: e.stat().st_mtime, reverse=True)
    for entry in entries:
        if entry.name.startswith("."):
            continue
        if entry.is_dir() and depth <= 1:
            # Count only direct files (not recursive) for display
            count = sum(
                1 for f in entry.iterdir()
                if f.is_file() and not f.name.startswith(".")
            )
            folders.append({
                "name": entry.name,
                "fileCount": count,
                "createdAt": datetime.fromtimestamp(entry.stat().st_mtime, tz=timezone.utc).isoformat(),
            })
        elif entry.is_file():
            files.append(_file_stat(entry, folder))
    if depth == 0:
        folders.sort(key=lambda s: (0 if s["name"] == "Geral" else 1, s["name"]))
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


async def get_files_with_content_by_names(filenames: list[str]) -> list[dict]:
    """Extrai conteúdo apenas dos arquivos especificados por nome."""
    names_set = set(filenames)
    result = []
    for entry in DATA_DIR.rglob("*"):
        if not entry.is_file() or entry.name.startswith("."):
            continue
        if entry.name not in names_set:
            continue
        rel = entry.relative_to(DATA_DIR)
        folder = str(rel.parent) if str(rel.parent) != "." else ""
        content = await extract_content(entry)
        result.append({**_file_stat(entry, folder), "content": content})
    return result


async def get_spaces() -> list[dict]:
    """Retorna apenas as pastas de nível raiz (espaços/sessões). 'Geral' sempre primeiro."""
    spaces = []
    for entry in sorted(DATA_DIR.iterdir(), key=lambda e: e.stat().st_mtime, reverse=True):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        count = sum(1 for f in entry.rglob("*") if f.is_file() and not f.name.startswith("."))
        spaces.append({
            "name": entry.name,
            "fileCount": count,
            "createdAt": datetime.fromtimestamp(entry.stat().st_mtime, tz=timezone.utc).isoformat(),
        })
    spaces.sort(key=lambda s: (0 if s["name"] == "Geral" else 1, s["name"]))
    return spaces


async def get_space_structure() -> dict:
    """Retorna {nome_do_espaço: [nome_da_pasta, ...]} para o serviço de insights."""
    structure = {}
    for space_dir in sorted(DATA_DIR.iterdir(), key=lambda e: e.name):
        if not space_dir.is_dir() or space_dir.name.startswith("."):
            continue
        subfolders = sorted(
            f.name for f in space_dir.iterdir()
            if f.is_dir() and not f.name.startswith(".")
        )
        structure[space_dir.name] = subfolders
    return structure


async def create_folder(path: str) -> None:
    """Cria pasta simples (espaço) ou aninhada (espaço/subpasta)."""
    target = (DATA_DIR / path).resolve()
    if not target.is_relative_to(DATA_DIR.resolve()):
        raise ValueError("Caminho inválido")
    rel = target.relative_to(DATA_DIR.resolve())
    if len(rel.parts) > 2:
        raise ValueError("Máximo 2 níveis de pasta suportados")
    if any(part.startswith(".") for part in rel.parts):
        raise ValueError("Nome de pasta inválido")
    if target.exists():
        raise ValueError(f"Pasta '{path}' já existe")
    # Ensure parent space exists before creating subfolder
    if len(rel.parts) == 2 and not target.parent.is_dir():
        raise ValueError(f"Espaço '{rel.parts[0]}' não existe")
    await asyncio.to_thread(target.mkdir, parents=False, exist_ok=False)


async def delete_folder(path: str) -> None:
    """Remove pasta (espaço ou subpasta), incluindo todo o conteúdo."""
    if Path(path).parts[0] == "Geral":
        raise PermissionError("O espaço 'Geral' é permanente e não pode ser excluído")
    target = (DATA_DIR / path).resolve()
    if not target.is_relative_to(DATA_DIR.resolve()):
        raise PermissionError("Acesso negado")
    if not target.is_dir():
        raise FileNotFoundError(f"Pasta não encontrada: {path}")
    await asyncio.to_thread(shutil.rmtree, target)


async def move_file(filename: str, from_folder: str, to_folder: str) -> None:
    safe_file = Path(filename).name
    src_dir = _safe_dir(from_folder)
    dst_dir = _safe_dir(to_folder)
    src = src_dir / safe_file
    if not src.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    dst = dst_dir / safe_file
    if dst.exists():
        raise ValueError("Já existe um arquivo com este nome na pasta destino")
    await asyncio.to_thread(src.rename, dst)


async def create_file(name: str, folder: str, content: str) -> dict:
    """Cria um novo arquivo de texto com conteúdo fornecido pelo usuário."""
    safe_name = Path(name).name
    if not safe_name or safe_name.startswith("."):
        raise ValueError("Nome de arquivo inválido")
    target_dir = _safe_dir(folder)
    file_path = target_dir / safe_name
    if file_path.exists():
        raise ValueError(f"Já existe um arquivo chamado '{safe_name}' nesta pasta")
    await asyncio.to_thread(file_path.write_text, content, "utf-8")
    return _file_stat(file_path, folder)


async def rename_file(filename: str, folder: str, new_name: str) -> None:
    safe_file = Path(filename).name
    safe_new  = Path(new_name).name
    if not safe_new or safe_new.startswith("."):
        raise ValueError("Nome de arquivo inválido")
    # Preserve extension when new_name has no extension
    if not Path(safe_new).suffix and Path(safe_file).suffix:
        safe_new = safe_new + Path(safe_file).suffix
    src_dir = _safe_dir(folder)
    src = src_dir / safe_file
    if not src.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    dst = src_dir / safe_new
    if dst.exists():
        raise ValueError("Já existe um arquivo com este nome na pasta")
    await asyncio.to_thread(src.rename, dst)


async def delete_file(filename: str, folder: str = "") -> None:
    safe_file = Path(filename).name
    if not safe_file or safe_file.startswith("."):
        raise ValueError("Nome de arquivo inválido")
    target_dir = _safe_dir(folder)
    file_path = target_dir / safe_file
    if not str(file_path).startswith(str(DATA_DIR)):
        raise PermissionError("Acesso negado")
    if not file_path.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    await asyncio.to_thread(file_path.unlink)
