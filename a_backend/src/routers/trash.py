"""
Router para gerenciamento da lixeira de arquivos.

Endpoints (prefixo /api/trash):
  GET    /               — listar itens da lixeira
  POST   /{id}/restore   — restaurar item ao local original
  DELETE /empty          — esvaziar lixeira (exclusão permanente de tudo)
  DELETE /{id}           — excluir item permanentemente
"""

import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from src.dependencies import get_current_user
from src.database import SessionLocal, User, TrashItem
from src.config import USERS_DATA_DIR

router = APIRouter()


def _trash_dir(user_id: int) -> Path:
    return USERS_DATA_DIR / ".trash" / str(user_id)


# ── GET / ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_trash(current_user: User = Depends(get_current_user)):
    def _query():
        db = SessionLocal()
        try:
            items = (
                db.query(TrashItem)
                .filter_by(user_id=current_user.id)
                .order_by(TrashItem.deleted_at.desc())
                .all()
            )
            return [
                {
                    "id":              item.id,
                    "filename":        item.filename,
                    "original_folder": item.original_folder,
                    "deleted_at":      item.deleted_at.isoformat() if item.deleted_at else None,
                    "expires_at":      item.expires_at.isoformat() if item.expires_at else None,
                    "size":            item.size,
                    "ext":             item.ext,
                }
                for item in items
            ]
        finally:
            db.close()

    return {"items": await asyncio.to_thread(_query)}


# ── POST /{id}/restore ────────────────────────────────────────────────────────

@router.post("/{item_id}/restore")
async def restore_trash_item(item_id: int, current_user: User = Depends(get_current_user)):
    def _restore():
        db = SessionLocal()
        try:
            item = db.query(TrashItem).filter_by(id=item_id, user_id=current_user.id).first()
            if not item:
                raise HTTPException(status_code=404, detail="Item não encontrado na lixeira.")

            trash_path = _trash_dir(current_user.id) / item.trash_filename
            if not trash_path.is_file():
                db.delete(item)
                db.commit()
                raise HTTPException(status_code=404, detail="Arquivo não encontrado na lixeira.")

            user_dir = USERS_DATA_DIR / str(current_user.id)
            if item.original_folder:
                dest_dir = (user_dir / item.original_folder).resolve()
                if not dest_dir.is_relative_to(user_dir.resolve()):
                    dest_dir = user_dir  # fallback: raiz do usuário
                dest_dir.mkdir(parents=True, exist_ok=True)
            else:
                dest_dir = user_dir

            dest_path = dest_dir / item.filename
            if dest_path.exists():
                stem   = Path(item.filename).stem
                suffix = Path(item.filename).suffix
                dest_path = dest_dir / f"{stem}_restaurado{suffix}"

            trash_path.rename(dest_path)
            db.delete(item)
            db.commit()
            return {"filename": dest_path.name, "folder": item.original_folder}
        finally:
            db.close()

    result = await asyncio.to_thread(_restore)
    return {"message": "Arquivo restaurado com sucesso.", **result}


# ── DELETE /empty ─────────────────────────────────────────────────────────────

@router.delete("/empty")
async def empty_trash(current_user: User = Depends(get_current_user)):
    def _empty():
        db = SessionLocal()
        try:
            items = db.query(TrashItem).filter_by(user_id=current_user.id).all()
            tdir  = _trash_dir(current_user.id)
            for item in items:
                p = tdir / item.trash_filename
                if p.is_file():
                    p.unlink()
                db.delete(item)
            db.commit()
            return len(items)
        finally:
            db.close()

    count = await asyncio.to_thread(_empty)
    return {"message": f"{count} arquivo(s) excluído(s) permanentemente."}


# ── DELETE /{id} ──────────────────────────────────────────────────────────────

@router.delete("/{item_id}")
async def delete_trash_item(item_id: int, current_user: User = Depends(get_current_user)):
    def _delete():
        db = SessionLocal()
        try:
            item = db.query(TrashItem).filter_by(id=item_id, user_id=current_user.id).first()
            if not item:
                raise HTTPException(status_code=404, detail="Item não encontrado na lixeira.")
            p = _trash_dir(current_user.id) / item.trash_filename
            if p.is_file():
                p.unlink()
            db.delete(item)
            db.commit()
        finally:
            db.close()

    await asyncio.to_thread(_delete)
    return {"message": "Arquivo excluído permanentemente."}
