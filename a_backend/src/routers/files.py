from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import List

from src.config import DATA_DIR
from src.services.file_service import (
    get_items, get_all_files_flat,
    create_folder, delete_folder,
    move_file, delete_file,
)

router = APIRouter()
MAX_FILE_SIZE = 50 * 1024 * 1024


class FolderCreate(BaseModel):
    name: str


class MoveRequest(BaseModel):
    to_folder: str = ""


@router.get("")
async def list_items(folder: str = Query(default="")):
    try:
        return await get_items(folder)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def list_all_files():
    try:
        files = await get_all_files_flat()
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_files(
    folder: str = Query(default=""),
    files: List[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado")

    if folder:
        upload_dir = DATA_DIR / Path(folder).name
        if not upload_dir.is_dir():
            raise HTTPException(status_code=404, detail=f"Pasta não encontrada: {folder}")
    else:
        upload_dir = DATA_DIR

    uploaded = []
    for upload in files:
        if not upload.filename:
            continue
        content = await upload.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"Arquivo muito grande: {upload.filename}")
        raw = Path(upload.filename).name
        sanitized = "".join(c if (c.isalnum() or c in "._-") else "_" for c in raw).strip("_") or "arquivo"
        ext = Path(sanitized).suffix.lower()
        base = Path(sanitized).stem
        final_name = sanitized
        counter = 1
        while (upload_dir / final_name).exists():
            final_name = f"{base}_{counter}{ext}"
            counter += 1
        (upload_dir / final_name).write_bytes(content)
        uploaded.append({"name": final_name, "size": len(content), "ext": ext, "folder": folder or None})

    if not uploaded:
        raise HTTPException(status_code=400, detail="Nenhum arquivo válido recebido")
    return {"message": "Arquivos enviados com sucesso", "files": uploaded}


# ── Pasta: criar / deletar (antes de /{filename} para evitar conflito) ────────

@router.post("/folders")
async def create_folder_endpoint(body: FolderCreate):
    try:
        await create_folder(body.name)
        return {"message": f"Pasta '{body.name}' criada com sucesso"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/folders/{folder_name}")
async def delete_folder_endpoint(folder_name: str):
    try:
        await delete_folder(folder_name)
        return {"message": f"Pasta '{folder_name}' removida com sucesso"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Arquivo: mover / deletar ─────────────────────────────────────────────────

@router.patch("/{filename}/move")
async def move_file_endpoint(
    filename: str,
    body: MoveRequest,
    from_folder: str = Query(default=""),
):
    try:
        await move_file(filename, from_folder, body.to_folder)
        return {"message": "Arquivo movido com sucesso"}
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{filename}")
async def remove_file(filename: str, folder: str = Query(default="")):
    try:
        await delete_file(filename, folder)
        return {"message": "Arquivo removido com sucesso"}
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
