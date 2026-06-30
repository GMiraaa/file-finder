from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.file_service import get_files_with_content
from src.services.gemini_service import search_files

router = APIRouter()


class SearchRequest(BaseModel):
    query: str


@router.post("/")
async def search(body: SearchRequest):
    if not body.query or not body.query.strip():
        raise HTTPException(status_code=400, detail="A descrição da busca é obrigatória")

    try:
        files_with_content = await get_files_with_content()

        if not files_with_content:
            return {"results": [], "total": 0, "message": "Nenhum arquivo disponível para busca"}

        relevant_files = await search_files(body.query.strip(), files_with_content)

        return {"results": relevant_files, "total": len(relevant_files)}

    except Exception as e:
        print(f"[search] Erro: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao realizar busca: {e}")
