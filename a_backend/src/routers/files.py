from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List

from src.config import DATA_DIR
from src.services.file_service import get_all_files, delete_file

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.get("/")
async def list_files():
    try:
        files = await get_all_files()
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar arquivos: {e}")


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado")

    uploaded = []

    for upload in files:
        if not upload.filename:
            continue

        content = await upload.read()

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Arquivo muito grande: {upload.filename} (máximo 50 MB)",
            )

        # Sanitiza o nome do arquivo
        raw_name = Path(upload.filename).name
        sanitized = "".join(
            c if (c.isalnum() or c in "._-") else "_" for c in raw_name
        ).strip("_") or "arquivo"

        ext = Path(sanitized).suffix.lower()
        base = Path(sanitized).stem

        # Resolve colisão de nome
        final_name = sanitized
        counter = 1
        while (DATA_DIR / final_name).exists():
            final_name = f"{base}_{counter}{ext}"
            counter += 1

        (DATA_DIR / final_name).write_bytes(content)

        uploaded.append({"name": final_name, "size": len(content), "ext": ext})

    if not uploaded:
        raise HTTPException(status_code=400, detail="Nenhum arquivo válido recebido")

    return {"message": "Arquivos enviados com sucesso", "files": uploaded}


@router.delete("/{filename}")
async def remove_file(filename: str):
    try:
        await delete_file(filename)
        return {"message": "Arquivo removido com sucesso"}
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover arquivo: {e}")
