"""
RAG com ChromaDB + sentence-transformers.

Arquitetura:
  - Uma coleção ChromaDB por usuário: "user{user_id}"
  - Embeddings locais com paraphrase-multilingual-MiniLM-L12-v2 (sem consumir API)
  - Cada arquivo é fragmentado em chunks (~800 chars, 150 de overlap)
  - IDs de documento: MD5(user_id|folder|filename|idx) → únicos e determinísticos

Fluxo:
  - Upload  → index_file(...)        (chamado como BackgroundTask)
  - Delete  → delete_file(...)
  - Rename  → rename_file(...)       (delete old + reindex)
  - Move    → move_file(...)         (delete old + reindex com nova localização)
  - Chat    → search(query, user_id) → top-K chunks relevantes
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

# ── ChromaDB + embedding ──────────────────────────────────────────────────────

# Diretório persistente: raiz do projeto / chroma_db
_BASE_DIR = Path(__file__).resolve().parents[4]   # file-finder/
_CHROMA_PATH = _BASE_DIR / "chroma_db"

_chroma_client   = None
_embed_fn        = None
_EMBED_MODEL     = "paraphrase-multilingual-MiniLM-L12-v2"


def _client():
    global _chroma_client
    if _chroma_client is None:
        import chromadb
        _chroma_client = chromadb.PersistentClient(path=str(_CHROMA_PATH))
    return _chroma_client


def _embedding_fn():
    """Carrega o modelo de embeddings uma vez (download automático na 1ª vez)."""
    global _embed_fn
    if _embed_fn is None:
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
        _embed_fn = SentenceTransformerEmbeddingFunction(model_name=_EMBED_MODEL)
    return _embed_fn


def _collection(user_id: int):
    """Retorna (ou cria) a coleção do usuário."""
    return _client().get_or_create_collection(
        name=f"user{user_id}",
        embedding_function=_embedding_fn(),
        metadata={"hnsw:space": "cosine"},
    )


# ── Chunking ──────────────────────────────────────────────────────────────────

_CHUNK_SIZE = 800
_OVERLAP    = 150


def _chunk_text(text: str) -> list[str]:
    if not text:
        return []
    text = text.strip()
    if len(text) <= _CHUNK_SIZE:
        return [text]
    chunks, start = [], 0
    while start < len(text):
        end = min(start + _CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        start += _CHUNK_SIZE - _OVERLAP
    return chunks


def _doc_id(user_id: int, folder: str, filename: str, idx: int) -> str:
    key = f"{user_id}|{folder or ''}|{filename}|{idx}"
    return hashlib.md5(key.encode()).hexdigest()


# ── API pública ───────────────────────────────────────────────────────────────

def index_file_sync(filename: str, folder: str, content: Optional[str], user_id: int) -> None:
    """
    Indexa (ou re-indexa) um arquivo. Chamado de BackgroundTask — síncrono.
    Se o arquivo não tiver conteúdo extraível, faz nada.
    """
    if not content or not content.strip():
        return
    try:
        col    = _collection(user_id)
        chunks = _chunk_text(content)
        # Remove versão anterior do mesmo arquivo (se houver)
        _delete_by_file_sync(col, user_id, folder, filename)
        # Indexa os novos chunks
        ids, docs, metas = [], [], []
        for i, chunk in enumerate(chunks):
            ids.append(_doc_id(user_id, folder, filename, i))
            docs.append(chunk)
            metas.append({
                "user_id":  user_id,
                "filename": filename,
                "folder":   folder or "",
                "chunk":    i,
                "total":    len(chunks),
            })
        col.add(ids=ids, documents=docs, metadatas=metas)
        log.info("[vector] Indexado: %s (%d chunk(s))", filename, len(chunks))
    except Exception as exc:
        log.warning("[vector] Falha ao indexar '%s': %s", filename, exc)


async def index_file(filename: str, folder: str, content: Optional[str], user_id: int) -> None:
    await asyncio.to_thread(index_file_sync, filename, folder, content, user_id)


def _delete_by_file_sync(col, user_id: int, folder: str, filename: str) -> None:
    try:
        col.delete(where={
            "$and": [
                {"user_id":  {"$eq": user_id}},
                {"filename": {"$eq": filename}},
                {"folder":   {"$eq": folder or ""}},
            ]
        })
    except Exception as exc:
        log.warning("[vector] Falha ao remover '%s': %s", filename, exc)


def delete_file_sync(filename: str, folder: str, user_id: int) -> None:
    try:
        col = _collection(user_id)
        _delete_by_file_sync(col, user_id, folder, filename)
    except Exception as exc:
        log.warning("[vector] Falha ao remover índice de '%s': %s", filename, exc)


async def delete_file(filename: str, folder: str, user_id: int) -> None:
    await asyncio.to_thread(delete_file_sync, filename, folder, user_id)


def delete_folder_sync(folder: str, user_id: int) -> None:
    """Remove todos os chunks de arquivos dentro de uma pasta."""
    try:
        col = _collection(user_id)
        col.delete(where={
            "$and": [
                {"user_id": {"$eq": user_id}},
                {"folder":  {"$eq": folder or ""}},
            ]
        })
    except Exception as exc:
        log.warning("[vector] Falha ao remover índice da pasta '%s': %s", folder, exc)


async def delete_folder(folder: str, user_id: int) -> None:
    await asyncio.to_thread(delete_folder_sync, folder, user_id)


def rename_file_sync(old_name: str, folder: str, new_name: str, content: Optional[str], user_id: int) -> None:
    delete_file_sync(old_name, folder, user_id)
    if content:
        index_file_sync(new_name, folder, content, user_id)


async def rename_file(old_name: str, folder: str, new_name: str, content: Optional[str], user_id: int) -> None:
    await asyncio.to_thread(rename_file_sync, old_name, folder, new_name, content, user_id)


def move_file_sync(filename: str, old_folder: str, new_folder: str, content: Optional[str], user_id: int) -> None:
    delete_file_sync(filename, old_folder, user_id)
    if content:
        index_file_sync(filename, new_folder, content, user_id)


async def move_file(filename: str, old_folder: str, new_folder: str, content: Optional[str], user_id: int) -> None:
    await asyncio.to_thread(move_file_sync, filename, old_folder, new_folder, content, user_id)


def search_sync(query: str, user_id: int, n_results: int = 8) -> list[dict]:
    """
    Busca os chunks mais relevantes para `query` no índice do usuário.
    Retorna lista de dicts: {filename, folder, content, score}.
    """
    try:
        col = _collection(user_id)
        count = col.count()
        if count == 0:
            return []
        results = col.query(
            query_texts=[query],
            n_results=min(n_results, count),
            where={"user_id": {"$eq": user_id}},
            include=["documents", "metadatas", "distances"],
        )
        chunks = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            # distância cosine → similaridade (0–1, maior = mais similar)
            score = round(1 - dist, 4)
            chunks.append({
                "filename": meta["filename"],
                "folder":   meta["folder"],
                "content":  doc,
                "score":    score,
            })
        # Ordena por score decrescente
        chunks.sort(key=lambda c: c["score"], reverse=True)
        return chunks
    except Exception as exc:
        log.warning("[vector] Falha na busca: %s", exc)
        return []


async def search(query: str, user_id: int, n_results: int = 8) -> list[dict]:
    return await asyncio.to_thread(search_sync, query, user_id, n_results)
