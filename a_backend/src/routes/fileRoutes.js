const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { listFiles, uploadFiles, removeFile } = require('../controllers/fileController');

router.get('/', listFiles);
router.post('/upload', upload.array('files', 20), uploadFiles);
router.delete('/:filename', removeFile);

module.exports = router;
