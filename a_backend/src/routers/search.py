from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.dependencies import get_current_user, get_user_data_dir
from src.database import User
from src.services.file_service import get_files_with_content
from src.services.gemini_service import search_files

router = APIRouter()


class SearchRequest(BaseModel):
    query: str


@router.post("")
async def search(
    body: SearchRequest,
    current_user: User = Depends(get_current_user),
    data_dir: Path = Depends(get_user_data_dir),
):
    if not body.query or not body.query.strip():
        raise HTTPException(status_code=400, detail="A descrição da busca é obrigatória")

    try:
        files_with_content = await get_files_with_content(data_dir, current_user.id)

        if not files_with_content:
            return {"results": [], "total": 0, "message": "Nenhum arquivo disponível para busca"}

        relevant_files = await search_files(body.query.strip(), files_with_content)
        return {"results": relevant_files, "total": len(relevant_files)}

    except Exception as e:
        print(f"[search] Erro: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao realizar busca: {e}")
