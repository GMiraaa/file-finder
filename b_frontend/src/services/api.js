import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const getFiles = () => api.get('/files');

export const uploadFiles = (formData, onUploadProgress) =>
  api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });

export const deleteFile = (filename) =>
  api.delete(`/files/${encodeURIComponent(filename)}`);

export const searchFiles = (query) => api.post('/search', { query });
