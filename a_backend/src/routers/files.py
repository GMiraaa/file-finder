import asyncio
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from src.dependencies import get_current_user, get_user_data_dir
from src.database import SessionLocal, User, SpaceShare
from src.config import USERS_DATA_DIR
from src.services.file_service import (
    get_items, get_all_files_flat,
    create_folder, delete_folder, rename_folder,
    move_file, rename_file, delete_file,
    create_file, write_file_content, check_file_safety,
    get_space_structure, extract_content,
)
import src.services.vector_service as vec

router = APIRouter()
MAX_FILE_SIZE = 50 * 1024 * 1024


async def _index_file_bg(filename: str, folder: str, file_path: Path, user_id: int) -> None:
    """Background task: extrai conteúdo e indexa no ChromaDB."""
    try:
        content = await extract_content(file_path)
        await vec.index_file(filename, folder, content, user_id)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("[index_bg] %s: %s", filename, exc)


class FolderCreate(BaseModel):
    name: str

class MoveRequest(BaseModel):
    to_folder: str = ""

class RenameRequest(BaseModel):
    new_name: str

class CreateFileRequest(BaseModel):
    name: str
    content: str = ""
    folder: str = ""

class RenameFolderRequest(BaseModel):
    old_path: str
    new_name: str

class WriteContentRequest(BaseModel):
    content: str
    folder: str = ""


def _check_shared_access(owner_id: int, space_name: str, viewer_id: int) -> bool:
    """Verifica se viewer_id tem acesso ao espaço space_name do owner_id."""
    db = SessionLocal()
    try:
        return db.query(SpaceShare).filter_by(
            owner_id=owner_id, space_name=space_name, shared_with_id=viewer_id
        ).first() is not None
    finally:
        db.close()


@router.get("")
async def list_items(
    folder: str = Query(default=""),
    owner_id: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    # Espaço compartilhado: usa o data_dir do dono
    if owner_id is not None and owner_id != current_user.id:
        space_name = folder.split("/")[0] if folder else ""
        if not space_name:
            raise HTTPException(status_code=400, detail="Pasta obrigatória para espaços compartilhados.")
        has_access = await asyncio.to_thread(_check_shared_access, owner_id, space_name, current_user.id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Acesso negado a este espaço compartilhado.")
        data_dir = USERS_DATA_DIR / str(owner_id)
        effective_user_id = owner_id
    else:
        effective_user_id = current_user.id
    try:
        return await get_items(folder, data_dir, effective_user_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def list_all_files(
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        return {"files": await get_all_files_flat(data_dir, current_user.id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/structure")
async def get_structure(data_dir: Path = Depends(get_user_data_dir)):
    try:
        return await get_space_structure(data_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create")
async def create_file_endpoint(
    body: CreateFileRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        file_info = await create_file(body.name, body.folder, body.content, data_dir, current_user.id)
        # Indexa o conteúdo do novo arquivo no ChromaDB
        if body.content:
            background_tasks.add_task(
                vec.index_file_sync, body.name, body.folder or "", body.content, current_user.id
            )
        return {"message": "Arquivo criado com sucesso", "file": file_info}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    folder: str = Query(default=""),
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado")

    if folder:
        upload_dir = (data_dir / folder).resolve()
        if not upload_dir.is_relative_to(data_dir.resolve()) or not upload_dir.is_dir():
            raise HTTPException(status_code=404, detail=f"Pasta não encontrada: {folder}")
    else:
        upload_dir = data_dir

    uploaded = []
    for upload in files:
        if not upload.filename:
            continue
        content = await upload.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"Arquivo muito grande: {upload.filename}")
        raw       = Path(upload.filename).name
        sanitized = "".join(c if (c.isalnum() or c in "._-") else "_" for c in raw).strip("_") or "arquivo"
        try:
            check_file_safety(sanitized, content)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"{sanitized}: {e}")
        final_name = sanitized
        if (upload_dir / final_name).exists():
            raise HTTPException(status_code=409, detail=f"Já existe um arquivo chamado '{final_name}' nesta pasta.")
        (upload_dir / final_name).write_bytes(content)
        folder_part = f"{folder}/" if folder else ""
        uploaded.append({
            "name": final_name,
            "size": len(content),
            "ext": Path(sanitized).suffix.lower(),
            "folder": folder or None,
            "url": f"/files/{current_user.id}/{folder_part}{final_name}",
        })
        # Indexação RAG em background (não bloqueia a resposta)
        file_path = upload_dir / final_name
        uid = current_user.id
        background_tasks.add_task(
            _index_file_bg, final_name, folder, file_path, uid
        )

    if not uploaded:
        raise HTTPException(status_code=400, detail="Nenhum arquivo válido recebido")
    return {"message": "Arquivos enviados com sucesso", "files": uploaded}


@router.post("/folders")
async def create_folder_endpoint(
    body: FolderCreate,
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        await create_folder(body.name, data_dir)
        return {"message": f"Pasta '{body.name}' criada com sucesso"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/folders")
async def delete_folder_endpoint(
    path: str = Query(...),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        await delete_folder(path, data_dir)
        await vec.delete_folder(path, current_user.id)
        return {"message": f"Pasta '{path}' removida com sucesso"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{filename}/content")
async def write_content_endpoint(
    filename: str,
    body: WriteContentRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        await write_file_content(filename, body.folder, body.content, data_dir)
        # Re-indexa com o novo conteúdo
        background_tasks.add_task(
            vec.index_file_sync, filename, body.folder or "", body.content, current_user.id
        )
        return {"message": "Arquivo salvo com sucesso"}
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/folders/rename")
async def rename_folder_endpoint(
    body: RenameFolderRequest,
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        await rename_folder(body.old_path, body.new_name, data_dir)
        return {"message": "Pasta renomeada com sucesso"}
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{filename}/rename")
async def rename_file_endpoint(
    filename: str,
    body: RenameRequest,
    background_tasks: BackgroundTasks,
    folder: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        await rename_file(filename, folder, body.new_name, data_dir)
        # Reindexar com novo nome
        vec.delete_file_sync(filename, folder, current_user.id)
        from pathlib import Path as _Path
        actual_new = (body.new_name if _Path(body.new_name).suffix else body.new_name + _Path(filename).suffix)
        new_path = data_dir / folder / actual_new if folder else data_dir / actual_new
        background_tasks.add_task(_index_file_bg, actual_new, folder, new_path, current_user.id)
        return {"message": "Arquivo renomeado com sucesso"}
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{filename}/move")
async def move_file_endpoint(
    filename: str,
    body: MoveRequest,
    background_tasks: BackgroundTasks,
    from_folder: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        await move_file(filename, from_folder, body.to_folder, data_dir)
        # Reindexar: remove entrada antiga e indexa no novo local
        vec.delete_file_sync(filename, from_folder, current_user.id)
        new_path = data_dir / body.to_folder / filename if body.to_folder else data_dir / filename
        background_tasks.add_task(_index_file_bg, filename, body.to_folder, new_path, current_user.id)
        return {"message": "Arquivo movido com sucesso"}
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{filename}")
async def remove_file(
    filename: str,
    folder: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    try:
        await delete_file(filename, folder, data_dir)
        await vec.delete_file(filename, folder, current_user.id)
        return {"message": "Arquivo removido com sucesso"}
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
