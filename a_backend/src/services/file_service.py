import asyncio
import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

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
                f"Arquivo rejeitado: conteúdo identificado como {label}. "
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

def _safe_dir(folder: str, data_dir: Path) -> Path:
    """Resolve caminho dentro de data_dir com proteção contra path traversal (máx. 2 níveis)."""
    if not folder:
        return data_dir
    target = (data_dir / folder).resolve()
    if not target.is_relative_to(data_dir.resolve()):
        raise PermissionError("Acesso negado")
    rel = target.relative_to(data_dir.resolve())
    if len(rel.parts) > 2:
        raise ValueError("Máximo 2 níveis de pasta suportados")
    if not target.is_dir():
        raise FileNotFoundError(f"Pasta não encontrada: {folder}")
    return target


def _file_stat(entry: Path, folder: str, data_dir: Path, user_id: int) -> dict:
    stat = entry.stat()
    folder_part = f"{folder}/" if folder else ""
    return {
        "name": entry.name,
        "size": stat.st_size,
        "uploadedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "ext": entry.suffix.lower(),
        "folder": folder or None,
        "url": f"/api/files/serve/{user_id}/{folder_part}{entry.name}",
    }


# ── API pública (todas as funções recebem data_dir e user_id do usuário autenticado) ──

async def get_items(folder: str, data_dir: Path, user_id: int) -> dict:
    target = _safe_dir(folder, data_dir)
    rel    = target.resolve().relative_to(data_dir.resolve())
    depth  = len(rel.parts)
    files, folders = [], []
    for entry in sorted(target.iterdir(), key=lambda e: e.stat().st_mtime, reverse=True):
        if entry.name.startswith("."):
            continue
        if entry.is_dir() and depth <= 1:
            count = sum(1 for f in entry.iterdir() if f.is_file() and not f.name.startswith("."))
            folders.append({"name": entry.name, "fileCount": count,
                            "createdAt": datetime.fromtimestamp(entry.stat().st_mtime, tz=timezone.utc).isoformat()})
        elif entry.is_file():
            files.append(_file_stat(entry, folder, data_dir, user_id))
    if depth == 0:
        folders.sort(key=lambda s: (0 if s["name"] == "Geral" else 1, s["name"]))
    return {"files": files, "folders": folders}


async def get_all_files_flat(data_dir: Path, user_id: int) -> list[dict]:
    result = []
    for entry in data_dir.rglob("*"):
        if not entry.is_file() or entry.name.startswith("."):
            continue
        rel    = entry.relative_to(data_dir)
        folder = str(rel.parent) if str(rel.parent) != "." else ""
        result.append(_file_stat(entry, folder, data_dir, user_id))
    return sorted(result, key=lambda f: f["uploadedAt"], reverse=True)



async def get_files_with_content_by_names(filenames: list[str], data_dir: Path, user_id: int) -> list[dict]:
    names_set = set(filenames)
    result = []
    for entry in data_dir.rglob("*"):
        if not entry.is_file() or entry.name.startswith(".") or entry.name not in names_set:
            continue
        rel    = entry.relative_to(data_dir)
        folder = str(rel.parent) if str(rel.parent) != "." else ""
        content = await extract_content(entry)
        result.append({**_file_stat(entry, folder, data_dir, user_id), "content": content})
    return result


async def get_space_structure(data_dir: Path) -> dict:
    structure = {}
    for space_dir in sorted(data_dir.iterdir(), key=lambda e: e.name):
        if not space_dir.is_dir() or space_dir.name.startswith("."):
            continue
        structure[space_dir.name] = sorted(
            f.name for f in space_dir.iterdir() if f.is_dir() and not f.name.startswith(".")
        )
    return structure


async def rename_folder(old_path: str, new_name: str, data_dir: Path) -> None:
    """Renomeia espaço ou subpasta mantendo-a no mesmo diretório pai."""
    parts = Path(old_path).parts
    if len(parts) == 1 and parts[0] == "Geral":
        raise PermissionError("O espaço 'Geral' não pode ser renomeado")
    safe_new = Path(new_name).name
    if not safe_new or safe_new.startswith("."):
        raise ValueError("Nome inválido")
    old_dir = (data_dir / old_path).resolve()
    if not old_dir.is_relative_to(data_dir.resolve()):
        raise PermissionError("Acesso negado")
    if not old_dir.is_dir():
        raise FileNotFoundError(f"Pasta não encontrada: {old_path}")
    new_dir = old_dir.parent / safe_new
    if new_dir.exists():
        raise ValueError(f"Já existe uma pasta chamada '{safe_new}'")
    await asyncio.to_thread(old_dir.rename, new_dir)


async def create_folder(path: str, data_dir: Path) -> None:
    target = (data_dir / path).resolve()
    if not target.is_relative_to(data_dir.resolve()):
        raise ValueError("Caminho inválido")
    rel = target.relative_to(data_dir.resolve())
    if len(rel.parts) > 2:
        raise ValueError("Máximo 2 níveis de pasta suportados")
    if any(part.startswith(".") for part in rel.parts):
        raise ValueError("Nome de pasta inválido")
    if target.exists():
        raise ValueError(f"Pasta '{path}' já existe")
    if len(rel.parts) == 2 and not target.parent.is_dir():
        raise ValueError(f"Espaço '{rel.parts[0]}' não existe")
    await asyncio.to_thread(target.mkdir, parents=False, exist_ok=False)


async def delete_folder(path: str, data_dir: Path) -> None:
    # Bloqueia apenas a exclusão do espaço raiz 'Geral', não de suas subpastas
    if path == "Geral":
        raise PermissionError("O espaço 'Geral' é permanente e não pode ser excluído")
    target = (data_dir / path).resolve()
    if not target.is_relative_to(data_dir.resolve()):
        raise PermissionError("Acesso negado")
    if not target.is_dir():
        raise FileNotFoundError(f"Pasta não encontrada: {path}")
    await asyncio.to_thread(shutil.rmtree, target)


async def move_file(filename: str, from_folder: str, to_folder: str, data_dir: Path) -> None:
    safe_file = Path(filename).name
    src = _safe_dir(from_folder, data_dir) / safe_file
    if not src.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    dst = _safe_dir(to_folder, data_dir) / safe_file
    if dst.exists():
        raise ValueError("Já existe um arquivo com este nome na pasta destino")
    await asyncio.to_thread(src.rename, dst)


async def create_file(name: str, folder: str, content: str, data_dir: Path, user_id: int) -> dict:
    safe_name = Path(name).name
    if not safe_name or safe_name.startswith("."):
        raise ValueError("Nome de arquivo inválido")
    file_path = _safe_dir(folder, data_dir) / safe_name
    if file_path.exists():
        raise ValueError(f"Já existe um arquivo chamado '{safe_name}' nesta pasta")
    await asyncio.to_thread(file_path.write_text, content, "utf-8")
    return _file_stat(file_path, folder, data_dir, user_id)


async def write_file_content(filename: str, folder: str, content: str, data_dir: Path) -> None:
    """Sobrescreve o conteúdo de um arquivo de texto existente."""
    safe_file = Path(filename).name
    file_path = _safe_dir(folder, data_dir) / safe_file
    if not file_path.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    ext = file_path.suffix.lower()
    if ext in {'.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg','.pdf',
               '.mp4','.mp3','.zip','.docx','.xlsx','.pptx'}:
        raise ValueError("Tipo de arquivo não editável")
    await asyncio.to_thread(file_path.write_text, content, "utf-8")


async def rename_file(filename: str, folder: str, new_name: str, data_dir: Path) -> None:
    safe_file = Path(filename).name
    safe_new  = Path(new_name).name
    if not safe_new or safe_new.startswith("."):
        raise ValueError("Nome de arquivo inválido")
    if not Path(safe_new).suffix and Path(safe_file).suffix:
        safe_new = safe_new + Path(safe_file).suffix
    src_dir = _safe_dir(folder, data_dir)
    src = src_dir / safe_file
    if not src.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    dst = src_dir / safe_new
    if dst.exists():
        raise ValueError("Já existe um arquivo com este nome na pasta")
    await asyncio.to_thread(src.rename, dst)


async def delete_file(filename: str, folder: str, data_dir: Path) -> None:
    safe_file = Path(filename).name
    if not safe_file or safe_file.startswith("."):
        raise ValueError("Nome de arquivo inválido")
    file_path = _safe_dir(folder, data_dir) / safe_file
    if not file_path.is_relative_to(data_dir):
        raise PermissionError("Acesso negado")
    if not file_path.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {safe_file}")
    await asyncio.to_thread(file_path.unlink)
