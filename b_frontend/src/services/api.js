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

// ── Pastas ───────────────────────────────────────────────────────────────────
export const createFolder = (name) => api.post('/files/folders', { name });

export const deleteFolder = (name) =>
  api.delete(`/files/folders/${encodeURIComponent(name)}`);

// ── IA ───────────────────────────────────────────────────────────────────────
export const getInsights = (files, existingFolders = []) =>
  api.post('/insights', { files, existing_folders: existingFolders });

export const sendMessage = (message, history) =>
  api.post('/chat', { message, history });
