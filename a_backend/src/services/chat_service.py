import json
import os
import re
import asyncio
from google import genai
from google.genai import types

from src.services.file_service import get_files_with_content, get_files_with_content_by_names
from src.utils.helpers import format_size

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def _format_location(folder: str) -> str:
    """Formata a localização do arquivo como 'Espaço › Pasta' ou apenas 'Espaço'."""
    if not folder:
        return ""
    parts = folder.split("/")
    if len(parts) == 1:
        return f"\n  Localização: {parts[0]}"
    return f"\n  Localização: {parts[0]} › {'/'.join(parts[1:])}"

_ORGANIZAR_RULES = """\

ORGANIZAÇÃO DE ARQUIVOS:
Se o usuário pedir para MOVER, ORGANIZAR ou REDISTRIBUIR arquivos, responda \
EXCLUSIVAMENTE com uma linha no formato abaixo (sem texto antes ou depois):
AÇÃO:{"reply":"<mensagem para o usuário>","moves":[{"filename":"<nome exato>","from_folder":"<valor do campo from_folder do arquivo>","to_folder":"<destino>"}],"creates":[]}

Regras da ação:
- "reply": confirmação amigável do que será feito (1-2 frases).
- "moves": use os nomes e from_folder EXATAMENTE como listados abaixo.
- "to_folder": caminho do destino ("" = raiz, "Espaço", "Espaço/Subpasta").
- "creates": pastas a criar antes de mover, ex: [{"path":"NovoEspaço"}]. Deixe [] se o destino já existe.
- Não invente nomes de arquivos — use apenas os listados abaixo."""

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
4. Sempre informe a localização do arquivo (espaço e pasta) no formato: \
"📍 Localização: Espaço › Pasta" (ou apenas "Espaço" se não houver subpasta).
5. Responda sempre em português, de forma clara e concisa.
6. Nunca invente informações que não estejam nos arquivos.
{organizar_rules}

ARQUIVOS DISPONÍVEIS:
{file_context}"""

_SYSTEM_PROMPT_FOCUSED = """\
Você é o FileFinder AI. O usuário anexou arquivos específicos para esta conversa.

REGRAS:
1. Responda com base EXCLUSIVAMENTE no conteúdo dos arquivos anexados abaixo.
2. Cite o nome do arquivo ao referenciar informações específicas.
3. Sempre informe a localização do arquivo (espaço e pasta) no formato: \
"📍 Localização: Espaço › Pasta" (ou apenas "Espaço" se não houver subpasta).
4. Responda sempre em português, de forma clara e concisa.
5. Nunca invente informações que não estejam nos arquivos.
{organizar_rules}

ARQUIVOS ANEXADOS PELO USUÁRIO:
{file_context}"""


def _build_file_context(files_with_content: list[dict]) -> str:
    lines = []
    for f in files_with_content:
        folder_raw = f.get("folder") or ""
        line = (
            f"• {f['name']} ({f.get('ext', '?')}, {format_size(f['size'])})"
            f"\n  from_folder: \"{folder_raw}\""
            + _format_location(folder_raw)
        )
        if f.get("content"):
            line += f"\n  Conteúdo: {f['content'][:1500]}"
        else:
            line += "\n  [Arquivo binário — sem conteúdo extraível]"
        lines.append(line)
    return "\n\n".join(lines)


def _parse_response(text: str) -> tuple[str, dict | None]:
    """Detecta resposta de ação AÇÃO:{...} e separa reply + action."""
    text = text.strip()
    if text.startswith("AÇÃO:"):
        json_str = text[len("AÇÃO:"):]
        json_str = re.sub(r"^```[a-z]*\n?", "", json_str.strip())
        json_str = re.sub(r"\n?```$", "", json_str.strip())
        try:
            data = json.loads(json_str)
            reply = data.get("reply", "Ação de organização preparada.")
            action = {
                "moves":   data.get("moves", []),
                "creates": data.get("creates", []),
            }
            return reply, action
        except (json.JSONDecodeError, KeyError):
            pass
    return text, None


async def chat(message: str, history: list[dict], attached_files: list[str] | None = None) -> tuple[str, dict | None]:
    if attached_files:
        files_with_content = await get_files_with_content_by_names(attached_files)
        prompt_template = _SYSTEM_PROMPT_FOCUSED
    else:
        files_with_content = await get_files_with_content()
        prompt_template = _SYSTEM_PROMPT

    if not files_with_content:
        return (
            "Você ainda não fez upload de nenhum arquivo. "
            "Faça upload primeiro para que eu possa ajudá-lo!",
            None,
        )

    file_context = _build_file_context(files_with_content)
    system = prompt_template.format(
        file_context=file_context,
        organizar_rules=_ORGANIZAR_RULES,
    )

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

    return _parse_response(response.text.strip())
