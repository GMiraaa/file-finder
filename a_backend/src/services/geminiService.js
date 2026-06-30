const { GoogleGenerativeAI } = require('@google/generative-ai');
const { formatSize } = require('../utils/helpers');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function searchFiles(query, filesWithContent) {
  if (filesWithContent.length === 0) return [];

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const fileContext = filesWithContent
    .map((file) => {
      let block = `=== ARQUIVO: ${file.name} | Tipo: ${file.ext || 'desconhecido'} | Tamanho: ${formatSize(file.size)} ===\n`;
      block += file.content
        ? file.content
        : '[Arquivo binário — conteúdo não extraível, avalie pelo nome/extensão]';
      return block;
    })
    .join('\n\n---\n\n');

  const prompt = `Você é um assistente de busca de arquivos altamente preciso. Analise os arquivos listados abaixo e identifique TODOS que têm alguma relação com a descrição do usuário. Seja inclusivo: na dúvida, inclua o arquivo.

DESCRIÇÃO DO USUÁRIO: "${query}"

ARQUIVOS DISPONÍVEIS:
${fileContext}

REGRAS:
- Analise tanto o nome quanto o conteúdo de cada arquivo.
- Inclua arquivos com relação direta E indireta com a descrição.
- Escreva os motivos em português, de forma breve e clara.
- Responda SOMENTE com JSON válido — sem markdown, sem explicações fora do JSON.

FORMATO DE RESPOSTA:
{"relevant_files":[{"name":"nome_exato_do_arquivo.ext","reason":"Motivo breve em português"}]}

Se nenhum arquivo for relevante: {"relevant_files":[]}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  // Remove blocos de código markdown se presentes
  let jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Extrai o objeto JSON da resposta
  const match = jsonStr.match(/\{[\s\S]*\}/);
  if (match) jsonStr = match[0];

  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed.relevant_files) ? parsed.relevant_files : [];
  } catch (err) {
    console.error('Falha ao parsear resposta do Gemini:', raw);
    return [];
  }
}

module.exports = { searchFiles };
