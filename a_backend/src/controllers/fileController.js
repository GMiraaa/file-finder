const path = require('path');
const { getAllFiles, deleteFile } = require('../services/fileService');

async function listFiles(req, res) {
  try {
    const files = await getAllFiles();
    return res.json({ files });
  } catch (err) {
    console.error('listFiles error:', err);
    return res.status(500).json({ error: 'Erro ao listar arquivos' });
  }
}

async function uploadFiles(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const files = req.files.map((f) => ({
      name: f.filename,
      size: f.size,
      ext: path.extname(f.filename).toLowerCase(),
    }));

    return res.json({ message: 'Arquivos enviados com sucesso', files });
  } catch (err) {
    console.error('uploadFiles error:', err);
    return res.status(500).json({ error: 'Erro ao fazer upload' });
  }
}

async function removeFile(req, res) {
  try {
    const { filename } = req.params;
    await deleteFile(filename);
    return res.json({ message: 'Arquivo removido com sucesso' });
  } catch (err) {
    console.error('removeFile error:', err);
    return res.status(500).json({ error: 'Erro ao remover arquivo' });
  }
}

module.exports = { listFiles, uploadFiles, removeFile };
