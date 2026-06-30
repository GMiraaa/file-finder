const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../c_data');

// Garante que o diretório de dados existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

module.exports = { DATA_DIR };
