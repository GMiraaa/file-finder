import axios from 'axios';

const TOKEN_KEY   = 'ff_token';
const REFRESH_KEY = 'ff_refresh_token';

const api = axios.create({ baseURL: '/', timeout: 30_000 });
export default api;

// ── Interceptor de refresh automático ────────────────────────────────────────
let _refreshing = false;
let _queue = [];

const processQueue = (error, token = null) => {
  _queue.forEach((p) => error ? p.reject(error) : p.resolve(token));
  _queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) return Promise.reject(error);

      if (_refreshing) {
        return new Promise((resolve, reject) => {
          _queue.push({ resolve, reject });
        }).then((token) => {
          original.headers['Authorization'] = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      _refreshing = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
        const newAccess  = data.access_token;
        const newRefresh = data.refresh_token;
        localStorage.setItem(TOKEN_KEY, newAccess);
        localStorage.setItem(REFRESH_KEY, newRefresh);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
        processQueue(null, newAccess);
        original.headers['Authorization'] = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        return Promise.reject(refreshError);
      } finally {
        _refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Arquivos ─────────────────────────────────────────────────────────────────
export const getItems = (folder = '', ownerId = null) => {
  const params = {};
  if (folder) params.folder = folder;
  if (ownerId) params.owner_id = ownerId;
  return api.get('/api/files', { params });
};

export const getAllFiles = () => api.get('/api/files/all');

export const uploadFiles = (formData, onUploadProgress, folder = '', ownerId = null) => {
  const params = {};
  if (folder) params.folder = folder;
  if (ownerId) params.owner_id = ownerId;
  return api.post('/api/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
    params,
  });
};

export const deleteFile = (filename, folder = '', ownerId = null) =>
  api.delete(`/api/files/${encodeURIComponent(filename)}`, {
    params: { ...(folder ? { folder } : {}), ...(ownerId ? { owner_id: ownerId } : {}) },
  });

export const moveFile = (filename, fromFolder, toFolder, ownerId = null) =>
  api.patch(`/api/files/${encodeURIComponent(filename)}/move`,
    { to_folder: toFolder },
    { params: { ...(fromFolder ? { from_folder: fromFolder } : {}), ...(ownerId ? { owner_id: ownerId } : {}) } },
  );

export const renameFile = (filename, folder, newName, ownerId = null) =>
  api.patch(`/api/files/${encodeURIComponent(filename)}/rename`,
    { new_name: newName },
    { params: { ...(folder ? { folder } : {}), ...(ownerId ? { owner_id: ownerId } : {}) } },
  );

export const createFile = (name, folder, content, ownerId = null) =>
  api.post('/api/files/create', { name, folder: folder || '', content },
    ownerId ? { params: { owner_id: ownerId } } : {},
  );

export const writeFileContent = (filename, folder, content) =>
  api.put(`/api/files/${encodeURIComponent(filename)}/content`, { folder: folder || '', content });

// ── Espaços / Pastas ──────────────────────────────────────────────────────────
export const createFolder = (name, ownerId = null) =>
  api.post('/api/files/folders', { name }, ownerId ? { params: { owner_id: ownerId } } : {});

export const deleteFolder = (path) =>
  api.delete('/api/files/folders', { params: { path } });

export const renameFolder = (oldPath, newName) =>
  api.patch('/api/files/folders/rename', { old_path: oldPath, new_name: newName });

export const getSpaceStructure = () => api.get('/api/files/structure');

// ── Espaços Compartilhados ────────────────────────────────────────────────────
export const getSharedSpaces = () => api.get('/api/spaces/shared');

export const inviteToSpace = (spaceName, email, permission = 'viewer') =>
  api.post(`/api/spaces/${encodeURIComponent(spaceName)}/invite`, { email, permission });

export const getSpaceMembers = (spaceName) =>
  api.get(`/api/spaces/${encodeURIComponent(spaceName)}/members`);

export const removeMember = (spaceName, memberId) =>
  api.delete(`/api/spaces/${encodeURIComponent(spaceName)}/members/${memberId}`);

export const updateMemberPermission = (spaceName, memberId, permission) =>
  api.patch(`/api/spaces/${encodeURIComponent(spaceName)}/members/${memberId}`, { permission });

export const cancelInvite = (spaceName, inviteId) =>
  api.delete(`/api/spaces/${encodeURIComponent(spaceName)}/invites/${inviteId}`);

// ── Convites recebidos ────────────────────────────────────────────────────────
export const getMyInvites = () => api.get('/api/spaces/invites');

export const acceptInvite = (inviteId) =>
  api.post(`/api/spaces/invites/${inviteId}/accept`);

export const declineInvite = (inviteId) =>
  api.post(`/api/spaces/invites/${inviteId}/decline`);

// ── IA ───────────────────────────────────────────────────────────────────────
export const getInsights = (files, spacesStructure = {}) =>
  api.post('/api/insights', { files, spaces_structure: spacesStructure });

export const analyzeAllFiles = () =>
  api.post('/api/insights/analyze-all');

export const sendMessage = (message, history, attachedFileNames = []) =>
  api.post('/api/chat', { message, history, attached_files: attachedFileNames });

/**
 * Streaming SSE — chama onChunk(text) para cada trecho e resolve com {reply, action}.
 */
export async function sendMessageStream(message, history, attachedFiles = [], onChunk) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history, attached_files: attachedFiles }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = JSON.parse(line.slice(6));
      if (data.chunk) onChunk(data.chunk);
      if (data.done) return { reply: data.reply, action: data.action ?? null };
      if (data.error) throw new Error(data.message || data.error);
    }
  }
  return { reply: '', action: null };
}

export const suggestFiles = (q) =>
  api.get('/api/search/suggest', { params: { q } });

export const runAgent = (message) =>
  api.post('/api/agent', { message });

/**
 * Streaming do agente via SSE.
 * onEvent({type, text?, chunk?, actions?, can_undo?}) é chamado para cada evento.
 */
export async function runAgentStream(message, onEvent) {
  const token = localStorage.getItem('ff_token');
  const response = await fetch('/api/agent/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6));
      onEvent(event);
      if (event.type === 'done' || event.type === 'error') return;
    }
  }
}

export const undoAgent = () =>
  api.post('/api/agent/undo');

export const fileEditChat = (message, history, fileContent, filename) =>
  api.post('/api/chat/file-edit', { message, history, file_content: fileContent, filename });

// ── Perfil do usuário ─────────────────────────────────────────────────────────
export const updateProfile = (username, email) =>
  api.put('/api/auth/profile', { username, email });

export const changePassword = (currentPassword, newPassword) =>
  api.put('/api/auth/password', { current_password: currentPassword, new_password: newPassword });

export const deleteAccount = (password) =>
  api.delete('/api/auth/account', { data: { password } });

// ── Armazenamento ───────────────────────────────────────────────────────────────

export const getStorageInfo = () => api.get('/api/files/storage-info');

export const downloadZip = (files, ownerId = null) =>
  api.post('/api/files/download-zip', { files, owner_id: ownerId }, { responseType: 'blob' });

// ── Lixeira ───────────────────────────────────────────────────────────────────────
export const getTrashItems    = ()    => api.get('/api/trash');
export const restoreTrashItem = (id)  => api.post(`/api/trash/${id}/restore`);
export const deleteTrashItem  = (id)  => api.delete(`/api/trash/${id}`);
export const emptyTrash       = ()    => api.delete('/api/trash/empty');

// ── Atividade de espaço compartilhado ──────────────────────────────────────────
export const getSpaceActivity = (spaceName) =>
  api.get(`/api/spaces/${encodeURIComponent(spaceName)}/activity`);
