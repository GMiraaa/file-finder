import os
import asyncio
from google import genai
from google.genai import types

from src.services.file_service import get_files_with_content
from src.utils.helpers import format_size

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

_SYSTEM_PROMPT = """\
Você é o FileFinder AI, um assistente EXCLUSIVAMENTE especializado nos arquivos \
que o usuário fez upload nesta plataforma.

REGRAS ABSOLUTAS — siga sem exceções:
1. Responda SOMENTE perguntas relacionadas aos arquivos listados abaixo \
(conteúdo, resumo, comparação, localização de informações dentro dos arquivos).
2. Se o usuário perguntar qualquer coisa fora do escopo dos arquivos \
(clima, esportes, receitas, matemática, programação em geral, piadas, notícias, etc.), \
responda exatamente: "Só posso responder sobre os arquivos que você fez upload. \
Tem alguma dúvida sobre eles?"
3. Cite sempre o nome do arquivo quando referenciar uma informação específica.
4. Responda sempre em português, de forma clara e concisa.
5. Nunca invente informações que não estejam nos arquivos.

ARQUIVOS DISPONÍVEIS:
{file_context}"""


async def chat(message: str, history: list[dict]) -> str:
    files_with_content = await get_files_with_content()

    if not files_with_content:
        return (
            "Você ainda não fez upload de nenhum arquivo. "
            "Faça upload primeiro para que eu possa ajudá-lo!"
        )

    file_context = "\n\n".join(
        f"• {f['name']} ({f.get('ext', '?')}, {format_size(f['size'])})"
        + (
            f"\n  Conteúdo: {f['content'][:1500]}"
            if f.get("content")
            else "\n  [Arquivo binário — sem conteúdo extraível]"
        )
        for f in files_with_content
    )

    system = _SYSTEM_PROMPT.format(file_context=file_context)

    # Monta o histórico no formato aceito pelo SDK
    contents = [
        {"role": msg["role"], "parts": [{"text": msg["content"]}]}
        for msg in history
    ]
    contents.append({"role": "user", "parts": [{"text": message}]})

    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.4,
    )

    response = await asyncio.to_thread(
        _client.models.generate_content,
        model="gemini-2.5-flash",
        contents=contents,
        config=config,
    )

    return response.text.strip()
