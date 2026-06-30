require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const fileRoutes = require('./src/routes/fileRoutes');
const searchRoutes = require('./src/routes/searchRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE'],
  })
);

app.use(express.json({ limit: '10mb' }));

// Serve uploaded files as static assets
app.use('/files', express.static(path.join(__dirname, '../c_data')));

// API routes
app.use('/api/files', fileRoutes);
app.use('/api/search', searchRoutes);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
