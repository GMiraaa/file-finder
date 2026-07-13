import axios from 'axios';

const api = axios.create({ baseURL: '/' });
export default api;

// ── Arquivos ─────────────────────────────────────────────────────────────────
export const getItems = (folder = '') =>
  api.get('/api/files', { params: folder ? { folder } : {} });

export const getAllFiles = () => api.get('/api/files/all');

export const uploadFiles = (formData, onUploadProgress, folder = '') =>
  api.post('/api/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
    params: folder ? { folder } : {},
  });

export const deleteFile = (filename, folder = '') =>
  api.delete(`/api/files/${encodeURIComponent(filename)}`, {
    params: folder ? { folder } : {},
  });

export const moveFile = (filename, fromFolder, toFolder) =>
  api.patch(`/api/files/${encodeURIComponent(filename)}/move`,
    { to_folder: toFolder },
    { params: fromFolder ? { from_folder: fromFolder } : {} },
  );

export const renameFile = (filename, folder, newName) =>
  api.patch(`/api/files/${encodeURIComponent(filename)}/rename`,
    { new_name: newName },
    { params: folder ? { folder } : {} },
  );

export const createFile = (name, folder, content) =>
  api.post('/api/files/create', { name, folder: folder || '', content });

export const writeFileContent = (filename, folder, content) =>
  api.put(`/api/files/${encodeURIComponent(filename)}/content`, { folder: folder || '', content });

// ── Espaços / Pastas ──────────────────────────────────────────────────────────
export const createFolder = (name) => api.post('/api/files/folders', { name });

export const deleteFolder = (path) =>
  api.delete('/api/files/folders', { params: { path } });

export const renameFolder = (oldPath, newName) =>
  api.patch('/api/files/folders/rename', { old_path: oldPath, new_name: newName });

export const getSpaceStructure = () => api.get('/api/files/structure');

// ── IA ───────────────────────────────────────────────────────────────────────
export const getInsights = (files, spacesStructure = {}) =>
  api.post('/api/insights', { files, spaces_structure: spacesStructure });

export const sendMessage = (message, history, attachedFileNames = []) =>
  api.post('/api/chat', { message, history, attached_files: attachedFileNames });
