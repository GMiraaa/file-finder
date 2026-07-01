import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// ── Arquivos ─────────────────────────────────────────────────────────────────
export const getItems = (folder = '') =>
  api.get('/files', { params: folder ? { folder } : {} });

export const getAllFiles = () => api.get('/files/all');

export const uploadFiles = (formData, onUploadProgress, folder = '') =>
  api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
    params: folder ? { folder } : {},
  });

export const deleteFile = (filename, folder = '') =>
  api.delete(`/files/${encodeURIComponent(filename)}`, {
    params: folder ? { folder } : {},
  });

export const moveFile = (filename, fromFolder, toFolder) =>
  api.patch(`/files/${encodeURIComponent(filename)}/move`,
    { to_folder: toFolder },
    { params: fromFolder ? { from_folder: fromFolder } : {} },
  );

// ── Espaços / Pastas ──────────────────────────────────────────────────────────
export const createFolder = (name) => api.post('/files/folders', { name });

// usa query param 'path' para suportar caminhos com '/' (ex: Espaço/Subpasta)
export const deleteFolder = (path) =>
  api.delete('/files/folders', { params: { path } });

// retorna { "Financeiro": ["Relatórios", ...], ... }
export const getSpaceStructure = () => api.get('/files/structure');

// ── IA ───────────────────────────────────────────────────────────────────────
// spacesStructure: objeto { espaço: [subpastas] }
export const getInsights = (files, spacesStructure = {}) =>
  api.post('/insights', { files, spaces_structure: spacesStructure });

export const sendMessage = (message, history, attachedFileNames = []) =>
  api.post('/chat', { message, history, attached_files: attachedFileNames });
