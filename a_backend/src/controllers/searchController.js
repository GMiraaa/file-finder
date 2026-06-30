const { getFilesWithContent } = require('../services/fileService');
const { searchFiles } = require('../services/geminiService');

async function search(req, res) {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'A descrição da busca é obrigatória' });
    }

    const filesWithContent = await getFilesWithContent();

    if (filesWithContent.length === 0) {
      return res.json({ results: [], total: 0, message: 'Nenhum arquivo disponível para busca' });
    }

    const relevantFiles = await searchFiles(query.trim(), filesWithContent);

    return res.json({ results: relevantFiles, total: relevantFiles.length });
  } catch (err) {
    console.error('search error:', err);
    return res.status(500).json({ error: 'Erro ao realizar busca: ' + err.message });
  }
}

module.exports = { search };
