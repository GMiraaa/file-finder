const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('../config');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DATA_DIR);
  },
  filename: (_req, file, cb) => {
    // Decodifica o nome original (multer usa latin1 por padrão)
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const ext = path.extname(originalName).toLowerCase().replace(/[^\w.]/g, '');
    const base = path
      .basename(originalName, path.extname(originalName))
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100)
      .trim() || 'arquivo';

    let filename = base + ext;
    let finalName = filename;
    let counter = 1;

    // Evita colisão de nomes
    while (fs.existsSync(path.join(DATA_DIR, finalName))) {
      finalName = `${base}_${counter}${ext}`;
      counter++;
    }

    cb(null, finalName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB por arquivo
});

module.exports = upload;
