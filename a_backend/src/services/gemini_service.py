import os
import re
import json
import asyncio
from typing import Any

from google import genai

from src.utils.helpers import format_size

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


async def search_files(query: str, files_with_content: list[dict[str, Any]]) -> list[dict[str, str]]:
    if not files_with_content:
        return []

    file_context = "\n\n---\n\n".join(
        f"=== ARQUIVO: {f['name']} | Tipo: {f.get('ext', 'desconhecido')} | Tamanho: {format_size(f['size'])} ===\n"
        + (f["content"] if f.get("content") else "[Arquivo binário — conteúdo não extraível, avalie pelo nome/extensão]")
        for f in files_with_content
    )

    prompt = f"""Você é um assistente de busca de arquivos altamente preciso. Analise os arquivos listados abaixo e identifique TODOS que têm alguma relação com a descrição do usuário. Seja inclusivo: na dúvida, inclua o arquivo.

DESCRIÇÃO DO USUÁRIO: "{query}"

ARQUIVOS DISPONÍVEIS:
{file_context}

REGRAS:
- Analise tanto o nome quanto o conteúdo de cada arquivo.
- Inclua arquivos com relação direta E indireta com a descrição.
- Escreva os motivos em português, de forma breve e clara.
- Responda SOMENTE com JSON válido — sem markdown, sem explicações fora do JSON.

FORMATO DE RESPOSTA:
{{"relevant_files":[{{"name":"nome_exato_do_arquivo.ext","reason":"Motivo breve em português"}}]}}

Se nenhum arquivo for relevante: {{"relevant_files":[]}}"""

    response = await asyncio.to_thread(
        _client.models.generate_content,
        model="gemini-2.0-flash",
        contents=prompt,
    )
    raw = response.text.strip()

    # Remove blocos markdown se presentes
    json_str = re.sub(r"```json\s*", "", raw)
    json_str = re.sub(r"```\s*", "", json_str).strip()

    # Extrai o objeto JSON da resposta
    match = re.search(r"\{[\s\S]*\}", json_str)
    if match:
        json_str = match.group(0)

    try:
        parsed = json.loads(json_str)
        return parsed.get("relevant_files", [])
    except json.JSONDecodeError:
        print(f"[gemini_service] Falha ao parsear resposta: {raw}")
        return []
