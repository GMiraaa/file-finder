import asyncio
import io
import mimetypes
import uuid
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from jose import JWTError

from src.auth import decode_access_token
from src.dependencies import get_current_user, get_user_data_dir
from src.database import SessionLocal, User, SpaceShare, TrashItem, SpaceActivity
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
_bearer_optional = HTTPBearer(auto_error=False)


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

class DownloadZipRequest(BaseModel):
    files: List[dict]         # [{"name": str, "folder": str|None}]
    owner_id: Optional[int] = None


def _check_shared_access(owner_id: int, space_name: str, viewer_id: int) -> bool:
    """Verifica se viewer_id tem acesso ao espaço space_name do owner_id."""
    db = SessionLocal()
    try:
        return db.query(SpaceShare).filter_by(
            owner_id=owner_id, space_name=space_name, shared_with_id=viewer_id
        ).first() is not None
    finally:
        db.close()


def _check_editor_access(owner_id: int, space_name: str, user_id: int) -> bool:
    """Verifica se user_id tem permissão de EDITOR no espaço space_name do owner_id."""
    db = SessionLocal()
    try:
        share = db.query(SpaceShare).filter_by(
            owner_id=owner_id, space_name=space_name, shared_with_id=user_id
        ).first()
        return share is not None and share.permission == "editor"
    finally:
        db.close()


async def _resolve_dir(
    owner_id: Optional[int],
    current_user: User,
    folder: str,
    data_dir: Path,
) -> tuple[Path, int]:
    """Retorna (data_dir efetivo, user_id efetivo).
    Se owner_id for diferente do usuário atual, verifica permissão de editor."""
    if owner_id is not None and owner_id != current_user.id:
        space_name = folder.split("/")[0] if folder else ""
        if not space_name:
            raise HTTPException(status_code=400, detail="Pasta obrigatória para espaços compartilhados.")
        has_editor = await asyncio.to_thread(_check_editor_access, owner_id, space_name, current_user.id)
        if not has_editor:
            raise HTTPException(status_code=403, detail="Sem permissão de editor neste espaço.")
        return USERS_DATA_DIR / str(owner_id), owner_id
    return data_dir, current_user.id


async def _log_activity(owner_id: int, space_name: str, actor_id: int, action: str, target: str) -> None:
    """Registra atividade em espaço compartilhado (erros são silenciados)."""
    def _do():
        db = SessionLocal()
        try:
            db.add(SpaceActivity(
                owner_id=owner_id, space_name=space_name,
                actor_id=actor_id, action=action, target=target,
            ))
            db.commit()
        except Exception:
            pass
        finally:
            db.close()
    await asyncio.to_thread(_do)


async def _move_to_trash(filename: str, folder: str, data_dir: Path, user_id: int) -> None:
    """Move arquivo para a lixeira (.trash/{user_id}/) em vez de excluir permanentemente."""
    safe_name = Path(filename).name
    if folder:
        folder_path = (data_dir / folder).resolve()
        if not folder_path.is_relative_to(data_dir.resolve()):
            raise PermissionError("Acesso negado")
        src = folder_path / safe_name
    else:
        src = data_dir / safe_name

    if not src.is_file():
        raise FileNotFoundError(f"Arquivo não encontrado: {filename}")

    trash_dir = USERS_DATA_DIR / ".trash" / str(user_id)
    trash_dir.mkdir(parents=True, exist_ok=True)

    trash_fname = f"{uuid.uuid4().hex}_{filename}"
    size = src.stat().st_size
    ext  = Path(filename).suffix.lower()
    await asyncio.to_thread(src.rename, trash_dir / trash_fname)

    expires = datetime.now(tz=timezone.utc) + timedelta(days=30)

    def _store():
        db = SessionLocal()
        try:
            db.add(TrashItem(
                user_id=user_id, filename=filename,
                original_folder=folder or None,
                trash_filename=trash_fname,
                expires_at=expires, size=size, ext=ext,
            ))
            db.commit()
        finally:
            db.close()
    await asyncio.to_thread(_store)


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


@router.get("/storage-info")
async def get_storage_info(
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    """Retorna uso de armazenamento e cota do usuário."""
    QUOTA = 1 * 1024 * 1024 * 1024  # 1 GB padrão
    def _calc():
        return sum(f.stat().st_size for f in data_dir.rglob("*") if f.is_file())
    used = await asyncio.to_thread(_calc)
    return {
        "used_bytes":  used,
        "quota_bytes": QUOTA,
        "percent":     min(round(used / QUOTA * 100, 1), 100.0),
    }


@router.post("/download-zip")
async def download_zip(
    body: DownloadZipRequest,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    """Gera e retorna um arquivo ZIP com os arquivos selecionados."""
    if body.owner_id and body.owner_id != current_user.id:
        space_name = (body.files[0].get("folder") or "").split("/")[0] if body.files else ""
        has = await asyncio.to_thread(_check_shared_access, body.owner_id, space_name, current_user.id)
        if not has:
            raise HTTPException(status_code=403, detail="Acesso negado.")
        effective_dir = USERS_DATA_DIR / str(body.owner_id)
    else:
        effective_dir = data_dir

    def _make_zip():
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for fi in body.files:
                folder = fi.get("folder") or ""
                name   = fi.get("name") or ""
                if not name:
                    continue
                fp = (effective_dir / folder / name).resolve() if folder else (effective_dir / name).resolve()
                if fp.is_file() and fp.is_relative_to(effective_dir.resolve()):
                    zf.write(fp, f"{folder}/{name}" if folder else name)
        buf.seek(0)
        return buf

    buf = await asyncio.to_thread(_make_zip)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=arquivos.zip"},
    )


@router.get("/structure")
async def get_structure(data_dir: Path = Depends(get_user_data_dir)):
    try:
        return await get_space_structure(data_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/serve/{user_id}/{filepath:path}")
async def serve_file(
    user_id: int,
    filepath: str,
    token: Optional[str] = Query(default=None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional),
):
    """Serve arquivos com validação de JWT — aceita token no header ou ?token= (para <img>/<iframe>)."""
    raw_token = (credentials.credentials if credentials else None) or token
    if not raw_token:
        raise HTTPException(status_code=401, detail="Token obrigatório.")

    try:
        payload = decode_access_token(raw_token)
        current_user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")

    # Autorização: próprio usuário ou membro do espaço compartilhado
    if current_user_id != user_id:
        parts = filepath.split("/")
        space_name = parts[0] if len(parts) > 1 else ""
        if not space_name:
            raise HTTPException(status_code=403, detail="Acesso negado.")
        has_access = await asyncio.to_thread(_check_shared_access, user_id, space_name, current_user_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Acesso negado.")

    # Resolve caminho com proteção contra path traversal
    user_dir = (USERS_DATA_DIR / str(user_id)).resolve()
    file_path = (user_dir / filepath).resolve()
    if not file_path.is_relative_to(user_dir):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    media_type, _ = mimetypes.guess_type(file_path.name)
    return FileResponse(file_path, media_type=media_type or "application/octet-stream")


@router.post("/create")
async def create_file_endpoint(
    body: CreateFileRequest,
    background_tasks: BackgroundTasks,
    owner_id: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    effective_dir, effective_uid = await _resolve_dir(owner_id, current_user, body.folder or "", data_dir)
    try:
        file_info = await create_file(body.name, body.folder, body.content, effective_dir, effective_uid)
        if body.content:
            background_tasks.add_task(
                vec.index_file_sync, body.name, body.folder or "", body.content, effective_uid
            )
        # Log atividade em espaço compartilhado
        if owner_id and owner_id != current_user.id:
            space_name = (body.folder or "").split("/")[0]
            if space_name:
                await _log_activity(owner_id, space_name, current_user.id, "create", body.name)
        return {"message": "Arquivo criado com sucesso", "file": file_info}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    folder: str = Query(default=""),
    owner_id: Optional[int] = Query(default=None),
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    effective_dir, effective_uid = await _resolve_dir(owner_id, current_user, folder, data_dir)

    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado")

    if folder:
        upload_dir = (effective_dir / folder).resolve()
        if not upload_dir.is_relative_to(effective_dir.resolve()) or not upload_dir.is_dir():
            raise HTTPException(status_code=404, detail=f"Pasta não encontrada: {folder}")
    else:
        upload_dir = effective_dir

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
            "url": f"/api/files/serve/{effective_uid}/{folder_part}{final_name}",
        })
        file_path = upload_dir / final_name
        background_tasks.add_task(_index_file_bg, final_name, folder, file_path, effective_uid)

    if not uploaded:
        raise HTTPException(status_code=400, detail="Nenhum arquivo válido recebido")

    # Log atividade em espaço compartilhado
    if owner_id and owner_id != current_user.id and uploaded:
        space_name = folder.split("/")[0] if folder else ""
        if space_name:
            for f in uploaded:
                await _log_activity(owner_id, space_name, current_user.id, "upload", f["name"])

    return {"message": "Arquivos enviados com sucesso", "files": uploaded}


@router.post("/folders")
async def create_folder_endpoint(
    body: FolderCreate,
    owner_id: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    effective_dir, _ = await _resolve_dir(owner_id, current_user, body.name, data_dir)
    try:
        await create_folder(body.name, effective_dir)
        if owner_id and owner_id != current_user.id:
            space_name = body.name.split("/")[0]
            await _log_activity(owner_id, space_name, current_user.id, "create_folder", body.name)
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
    owner_id: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    effective_dir, effective_uid = await _resolve_dir(owner_id, current_user, folder, data_dir)
    try:
        await rename_file(filename, folder, body.new_name, effective_dir)
        vec.delete_file_sync(filename, folder, effective_uid)
        from pathlib import Path as _Path
        actual_new = (body.new_name if _Path(body.new_name).suffix else body.new_name + _Path(filename).suffix)
        new_path = effective_dir / folder / actual_new if folder else effective_dir / actual_new
        background_tasks.add_task(_index_file_bg, actual_new, folder, new_path, effective_uid)
        # Log atividade em espaço compartilhado
        if owner_id and owner_id != current_user.id:
            space_name = folder.split("/")[0] if folder else ""
            if space_name:
                await _log_activity(owner_id, space_name, current_user.id, "rename", f"{filename} → {body.new_name}")
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
    owner_id: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    effective_dir, effective_uid = await _resolve_dir(owner_id, current_user, from_folder, data_dir)
    try:
        await move_file(filename, from_folder, body.to_folder, effective_dir)
        vec.delete_file_sync(filename, from_folder, effective_uid)
        new_path = effective_dir / body.to_folder / filename if body.to_folder else effective_dir / filename
        background_tasks.add_task(_index_file_bg, filename, body.to_folder, new_path, effective_uid)
        # Log atividade em espaço compartilhado
        if owner_id and owner_id != current_user.id:
            space_name = from_folder.split("/")[0] if from_folder else ""
            if space_name:
                await _log_activity(owner_id, space_name, current_user.id, "move", filename)
        return {"message": "Arquivo movido com sucesso"}
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{filename}")
async def remove_file(
    filename: str,
    folder: str = Query(default=""),
    owner_id: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    if owner_id is not None and owner_id != current_user.id:
        # Espaço compartilhado → hard delete
        effective_dir, effective_uid = await _resolve_dir(owner_id, current_user, folder, data_dir)
        try:
            await delete_file(filename, folder, effective_dir)
            await vec.delete_file(filename, folder, effective_uid)
            space_name = folder.split("/")[0] if folder else ""
            if space_name:
                await _log_activity(owner_id, space_name, current_user.id, "delete", filename)
        except (ValueError, PermissionError) as e:
            raise HTTPException(status_code=400, detail=str(e))
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        # Arquivo próprio → soft delete (lixeira)
        try:
            await _move_to_trash(filename, folder, data_dir, current_user.id)
            await vec.delete_file(filename, folder, current_user.id)
        except (ValueError, PermissionError) as e:
            raise HTTPException(status_code=400, detail=str(e))
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Arquivo removido com sucesso"}
