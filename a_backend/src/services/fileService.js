const fs = require('fs').promises;
const path = require('path');
const { DATA_DIR } = require('../config');

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv', '.html', '.xml', '.js', '.ts',
  '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.css', '.scss', '.sass', '.yaml', '.yml', '.sh', '.bash',
  '.sql', '.log', '.env', '.ini', '.toml', '.conf', '.cfg',
  '.r', '.rb', '.php', '.go', '.rs', '.kt', '.swift',
]);

async function extractContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (TEXT_EXTENSIONS.has(ext)) {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.substring(0, 5000);
    }

    if (ext === '.pdf') {
      // require dinâmico evita execução de código de teste do pdf-parse no import
      const pdfParse = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text.substring(0, 5000);
    }

    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value.substring(0, 5000);
    }
  } catch (err) {
    console.error(`Erro ao extrair conteúdo de ${path.basename(filePath)}:`, err.message);
  }

  return null; // Binários / tipos não suportados
}

async function getAllFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const entries = await fs.readdir(DATA_DIR);

  const details = await Promise.all(
    entries
      .filter((name) => !name.startsWith('.'))
      .map(async (name) => {
        const filePath = path.join(DATA_DIR, name);
        const stats = await fs.stat(filePath);
        return {
          name,
          size: stats.size,
          uploadedAt: stats.mtime,
          ext: path.extname(name).toLowerCase(),
        };
      })
  );

  return details.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

async function deleteFile(filename) {
  // Previne path traversal
  const safe = path.basename(filename);
  if (!safe || safe.startsWith('.')) {
    throw new Error('Nome de arquivo inválido');
  }

  const filePath = path.join(DATA_DIR, safe);

  // Garante que o caminho está dentro de DATA_DIR
  if (!filePath.startsWith(DATA_DIR + path.sep) && filePath !== DATA_DIR) {
    throw new Error('Acesso negado');
  }

  await fs.unlink(filePath);
}

async function getFilesWithContent() {
  const files = await getAllFiles();

  const withContent = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(DATA_DIR, file.name);
      const content = await extractContent(filePath);
      return { ...file, content };
    })
  );

  return withContent;
}

module.exports = { getAllFiles, deleteFile, getFilesWithContent };
