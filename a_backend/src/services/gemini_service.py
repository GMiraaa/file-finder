import os
import re
import json
import asyncio
from typing import Any

from google import genai

from src.utils.helpers import format_size
from src.services.vector_service import search as vector_search

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


async def search_files(
    query: str,
    all_files: list[dict[str, Any]],
    user_id: int,
) -> list[dict[str, str]]:
    """
    Busca arquivos relevantes para `query` usando RAG:
      1. ChromaDB recupera os chunks mais similares semanticamente
      2. Gemini avalia os candidatos e retorna os relevantes com motivo
    """
    if not all_files:
        return []

    # ── Etapa 1: RAG — chunks relevantes ────────────────────────────────────
    chunks = await vector_search(query, user_id, n_results=12)

    # Monta conjunto de arquivos candidatos (únicos) com conteúdo relevante
    seen: set[str] = set()
    candidates: list[dict] = []
    for chunk in chunks:
        key = f"{chunk['folder']}|{chunk['filename']}"
        if key not in seen:
            seen.add(key)
            candidates.append(chunk)

    # Complementa com arquivos binários/não-indexados (avaliados pelo nome)
    indexed_names = {c["filename"] for c in candidates}
    for f in all_files:
        if f["name"] not in indexed_names:
            candidates.append({
                "filename": f["name"],
                "folder":   f.get("folder") or "",
                "content":  None,
                "score":    0,
            })

    if not candidates:
        return []

    # ── Etapa 2: Gemini avalia os candidatos ─────────────────────────────────
    context_parts = []
    for c in candidates:
        loc = f" (em: {c['folder']}/)" if c["folder"] else ""
        header = f"=== {c['filename']}{loc} ==="
        body   = c["content"] or "[sem conteúdo textual — avalie pelo nome/extensão]"
        context_parts.append(f"{header}\n{body}")
    file_context = "\n\n---\n\n".join(context_parts)

    prompt = f"""Analise os arquivos abaixo e identifique os relacionados com a descrição.

DESCRIÇÃO: "{query}"

ARQUIVOS CANDIDATOS:
{file_context}

RETORNE somente JSON válido:
{{"relevant_files":[{{"name":"nome.ext","reason":"motivo em português"}}]}}

Se nenhum for relevante: {{"relevant_files":[]}}"""

    response = await asyncio.to_thread(
        _client.models.generate_content,
        model="gemini-2.5-flash",
        contents=prompt,
    )
    raw = response.text.strip()
    json_str = re.sub(r"```[a-z]*\s*", "", raw).replace("```", "").strip()
    match = re.search(r"\{[\s\S]*\}", json_str)
    if match:
        try:
            return json.loads(match.group(0)).get("relevant_files", [])
        except json.JSONDecodeError:
            pass
    return []
