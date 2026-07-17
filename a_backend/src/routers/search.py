from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.dependencies import get_current_user, get_user_data_dir
from src.database import User
from src.services.file_service import get_all_files_flat
from src.services.gemini_service import search_files
from src.services.vector_service import search as vector_search

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
        all_files = await get_all_files_flat(data_dir, current_user.id)

        if not all_files:
            return {"results": [], "total": 0, "message": "Nenhum arquivo disponível para busca"}

        relevant_files = await search_files(body.query.strip(), all_files, current_user.id)
        return {"results": relevant_files, "total": len(relevant_files)}

    except Exception as e:
        print(f"[search] Erro: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao realizar busca: {e}")


@router.get("/suggest")
async def suggest(
    q: str = Query(default="", min_length=2),
    current_user: User = Depends(get_current_user),
):
    """
    Busca vetorial rápida (sem Gemini) para sugestões em tempo real.
    Retorna até 6 arquivos únicos mais relevantes para a query.
    """
    q = q.strip()
    if not q:
        return {"suggestions": []}
    try:
        chunks = await vector_search(q, current_user.id, n_results=12)
        seen: dict[str, dict] = {}
        for c in chunks:
            if c["score"] < 0.10:
                continue
            key = f"{c['folder']}|{c['filename']}"
            if key not in seen:
                seen[key] = {
                    "name":    c["filename"],
                    "folder":  c["folder"],
                    "score":   round(c["score"], 3),
                    "snippet": c["content"][:120].replace("\n", " "),
                }
        suggestions = list(seen.values())[:6]
        return {"suggestions": suggestions}
    except Exception as e:
        return {"suggestions": []}
