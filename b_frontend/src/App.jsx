import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FileGrid from './components/FileGrid';
import ChatPanel from './components/ChatPanel';
import UploadModal from './components/UploadModal';
import PreviewChatModal from './components/PreviewChatModal';
import ProfileModal from './components/ProfileModal';
import TrashView from './components/TrashView';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { useAuth } from './contexts/AuthContext';
import { useNotifications } from './contexts/NotificationsContext';
import {
  getItems, getAllFiles, deleteFile, deleteFolder,
  moveFile, renameFile, renameFolder, createFolder, getInsights, getSpaceStructure,
  uploadFiles, getSharedSpaces, getStorageInfo, getTrashItems,
} from './services/api';

// Extensões bloqueadas por segurança
const BLOCKED_EXTS = new Set([
  'exe','bat','cmd','com','msi','scr','vbs','pif','ps1','ps2',
  'reg','dll','hta','jar','jse','wsf','wsh','lnk','inf','sys',
]);

export default function App() {
  const { user, logout } = useAuth();
  const [authPage, setAuthPage] = useState('login');

  // Sempre volta para login ao sair
  useEffect(() => {
    if (!user) setAuthPage('login');
  }, [user]);

  if (!user) {
    return authPage === 'login'
      ? <LoginPage onGoRegister={() => setAuthPage('register')} />
      : <RegisterPage onGoLogin={() => setAuthPage('login')} />;
  }

  return <AppInner user={user} logout={logout} />;
}

function AppInner({ user, logout }) {
  const { addNotification } = useNotifications();
  // Items da view atual (files + folders/subpastas)
  const [items, setItems]                 = useState({ files: [], folders: [] });
  // Todos os arquivos flat (todos os espaços) para chat + "Meus Arquivos"
  const [allFilesFlat, setAllFilesFlat]   = useState([]);
  // Espaços (pastas raiz) — sempre atualizado independente da view
  const [allSpaces, setAllSpaces]         = useState([]);
  // Espaços compartilhados com o usuário
  const [sharedSpaces, setSharedSpaces]   = useState([]);
  const [pendingInsight, setPendingInsight] = useState(null);
  const [chatAttachFile, setChatAttachFile] = useState(null);
  const [previewFile, setPreviewFile]       = useState(null);

  const [loading, setLoading]             = useState(true);
  const [showUpload, setShowUpload]       = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [storageInfo, setStorageInfo]     = useState(null);   // { used_bytes, quota_bytes, percent }
  const [trashCount, setTrashCount]       = useState(0);
  // 'all' | 'recent' | 'SpaceName' | 'SpaceName/SubFolder' | '__shared__/{id}/{name}'
  const [activeView, setActiveView]       = useState('all');
  const [filenameQuery, setFilenameQuery] = useState('');
  const [filterExts, setFilterExts]       = useState([]);
  const [toast, setToast]                 = useState(null);
  const [isDark, setIsDark]               = useState(
    () => localStorage.getItem('theme') === 'dark'
  );
  // Paginação client-side para a view "all"
  const [allViewLimit, setAllViewLimit]   = useState(100);

  // ── Valores derivados de activeView ────────────────────────────────────────
  // Formato espaço compartilhado: '__shared__/{ownerId}/{spaceName}[/{subfolder}]'
  const isSharedView      = activeView.startsWith('__shared__/');
  const sharedParts       = isSharedView ? activeView.split('/') : [];  // ['__shared__', ownerId, spaceName, ...]
  const sharedOwnerId     = isSharedView ? parseInt(sharedParts[1], 10) : null;
  const sharedSpaceName   = isSharedView ? sharedParts[2] : null;        // top-level space name (para access check)
  const sharedSubPath     = isSharedView ? sharedParts.slice(2).join('/') : null; // caminho completo para API

  const isInSpace     = activeView !== 'all' && activeView !== 'recent' && !isSharedView;
  const currentFolder = isInSpace ? activeView : isSharedView ? sharedSubPath : '';
  const pathParts     = currentFolder ? currentFolder.split('/') : [];
  const currentSpaceName    = pathParts[0] || '';
  const currentSubfolder    = pathParts[1] || '';
  const isInSubfolder       = pathParts.length === 2;

  // Permissão do usuário atual no espaço compartilhado ativo
  const sharedPermission = isSharedView
    ? sharedSpaces.find(s => s.owner_id === sharedOwnerId && s.space_name === sharedSpaceName)?.permission ?? null
    : null;
  // Viewer = está em um espaço compartilhado mas NÃO é editor
  const isSharedViewer = isSharedView && sharedPermission !== 'editor';

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else         { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
    if (type === 'success') addNotification(message, 'success');
  };

  const loadItems = useCallback(async (folder = '', ownerId = null) => {
    try {
      const { data } = await getItems(folder, ownerId);
      setItems({ files: data.files || [], folders: data.folders || [] });
      if (!folder && !ownerId) setAllSpaces(data.folders || []);
    } catch {
      showToast('Erro ao conectar com o servidor. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllFlat = useCallback(async () => {
    try {
      const { data } = await getAllFiles();
      setAllFilesFlat(data.files || []);
    } catch { /* silently fail */ }
  }, []);

  const refreshSpaces = useCallback(async () => {
    try {
      const { data } = await getItems('');
      setAllSpaces(data.folders || []);
    } catch { /* silent */ }
  }, []);

  const loadSharedSpaces = useCallback(async () => {
    try {
      const { data } = await getSharedSpaces();
      setSharedSpaces(data.shared_spaces || []);
    } catch { /* silent */ }
  }, []);

  const loadStorageInfo = useCallback(async () => {
    try {
      const { data } = await getStorageInfo();
      setStorageInfo(data);
    } catch { /* silent */ }
  }, []);

  const loadTrashCount = useCallback(async () => {
    try {
      const { data } = await getTrashItems();
      setTrashCount((data.items || []).length);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadItems(''); loadAllFlat(); loadSharedSpaces(); loadStorageInfo(); loadTrashCount(); }, [loadItems, loadAllFlat, loadSharedSpaces, loadStorageInfo, loadTrashCount]);

  const refresh = useCallback((folder = currentFolder) => {
    if (isSharedView) {
      loadItems(sharedSubPath, sharedOwnerId);
    } else {
      loadItems(folder);
      loadAllFlat();
      if (folder !== '') refreshSpaces();
    }
  }, [currentFolder, isSharedView, sharedSubPath, sharedOwnerId, loadItems, loadAllFlat, refreshSpaces]);

  // ── Navegação unificada ────────────────────────────────────────────────────
  const handleViewChange = useCallback((view) => {
    setFilenameQuery('');
    setActiveView(view);
    setAllViewLimit(100); // reset paginação ao mudar de view

    if (view.startsWith('__shared__/')) {
      const parts = view.split('/');
      const ownerId = parseInt(parts[1], 10);
      const subPath = parts.slice(2).join('/');   // 'spaceName' ou 'spaceName/subfolder'
      setLoading(true);
      loadItems(subPath, ownerId).finally(() => setLoading(false));
      return;
    }

    if (view === 'all' || view === 'recent') {
      if (currentFolder !== '') loadItems('');
    } else if (view === 'trash') {
      // lixeira não faz loadItems — o TrashView gerencia seus próprios dados
    } else {
      const cachedFiles = allFilesFlat.filter((f) => (f.folder || '') === view);
      setItems((prev) => ({ files: cachedFiles, folders: prev.folders }));
      loadItems(view);
    }
  }, [currentFolder, loadItems, allFilesFlat]);

  // FolderCard click: em "all" vai para espaço, em espaço vai para subpasta
  const handleNavigateFolder = (name) => {
    if (isSharedView) {
      handleViewChange(`__shared__/${sharedOwnerId}/${sharedSubPath}/${name}`);
      return;
    }
    if (!isInSpace) {
      handleViewChange(name);                                  // navega para espaço
    } else if (!isInSubfolder) {
      handleViewChange(`${currentSpaceName}/${name}`);         // navega para subpasta
    }
  };

  // Voltar: de subpasta → espaço, de espaço → all
  const handleNavigateBack = () => {
    if (isSharedView) {
      if (isInSubfolder) handleViewChange(`__shared__/${sharedOwnerId}/${sharedSpaceName}`);
      else handleViewChange('all');
      return;
    }
    if (isInSubfolder) handleViewChange(currentSpaceName);
    else handleViewChange('all');
  };

  // ── CRUD Espaços (sidebar) ─────────────────────────────────────────────────
  const handleCreateSession = async (name) => {
    try {
      await createFolder(name);
      showToast(`Espaço "${name}" criado.`, 'success');
      await refreshSpaces();
      handleViewChange(name);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao criar espaço.');
    }
  };

  const handleDeleteSession = async (name) => {
    try {
      await deleteFolder(name);
      showToast(`Espaço "${name}" removido.`, 'success');
      if (activeView === name || activeView.startsWith(`${name}/`)) {
        setActiveView('all');
        setLoading(true);
        loadItems('').finally(() => setLoading(false));
        loadAllFlat();
      } else {
        refreshSpaces();
      }
    } catch {
      showToast('Erro ao remover espaço.');
    }
  };

  // ── CRUD Pastas (dentro de espaço — grid) ─────────────────────────────────
  const handleCreateSubfolder = async (name) => {
    const fullPath = `${currentSpaceName}/${name}`;
    try {
      await createFolder(fullPath, isSharedView ? sharedOwnerId : null);
      showToast(`Pasta "${name}" criada.`, 'success');
      refresh(currentFolder);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao criar pasta.');
    }
  };

  // Deletar pasta do grid (espaço em "all" view, ou subpasta dentro de espaço)
  const handleDeleteFolder = async (name) => {
    const isSpace = !isInSpace;  // estamos no all/recent view → é um espaço
    const fullPath = isSpace ? name : `${currentSpaceName}/${name}`;
    try {
      await deleteFolder(fullPath);
      showToast(`"${name}" removido.`, 'success');
      if (activeView === name || activeView.startsWith(`${name}/`)) {
        handleViewChange('all');
      } else if (isSpace) {
        await refreshSpaces();
      } else {
        refresh(currentFolder);
      }
    } catch {
      showToast('Erro ao remover pasta.');
    }
  };

  // ── Mover arquivo (drag-drop) ──────────────────────────────────────────────
  const handleMoveFile = async (filename, fromFolder, toFolder) => {
    // Quando em view de espaço e o destino é uma subpasta (sem barra), monta o caminho completo
    const fullToFolder =
      (isInSpace && !isInSubfolder && toFolder && !toFolder.includes('/'))
        ? `${currentSpaceName}/${toFolder}`
        : toFolder;
    try {
      await moveFile(filename, fromFolder, fullToFolder, isSharedView ? sharedOwnerId : null);
      const dest = fullToFolder || 'raiz';
      showToast(`"${filename}" movido para "${dest}".`, 'success');
      refresh(currentFolder);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao mover arquivo.');
    }
  };

  // ── Mover arquivo (via modal — caminho completo, sem ajuste de contexto) ───
  const handleMoveFileToDestination = useCallback(async (filename, fromFolder, toFolder) => {
    try {
      await moveFile(filename, fromFolder, toFolder, isSharedView ? sharedOwnerId : null);
      showToast(`"${filename}" movido para "${toFolder || 'raiz'}".`, 'success');
      refresh(currentFolder);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao mover arquivo.');
    }
  }, [currentFolder, refresh, isSharedView, sharedOwnerId]);

  // ── Aplicar ações de organização vindas do chat ──────────────────────────────
  const handleApplyMoves = useCallback(async (moves, creates) => {
    try {
      for (const { path } of creates) {
        await createFolder(path);
      }
      for (const { filename, from_folder, to_folder } of moves) {
        await moveFile(filename, from_folder ?? '', to_folder ?? '');
      }
      const n = moves.length;
      showToast(`${n} arquivo${n !== 1 ? 's' : ''} movido${n !== 1 ? 's' : ''} com sucesso.`, 'success');
      refresh('');
      await refreshSpaces();
      return { success: true };
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao organizar arquivos.');
      return { success: false };
    }
  }, [refresh, refreshSpaces]);

  // ── Aplicar insight ────────────────────────────────────────────────────────
  const handleApplyInsight = async (insight) => {    // Novo formato com groups
    if (insight.groups) {
      const { suggested_space, is_new_space, suggested_folder, is_new_folder, target_files } = insight;
      if (!suggested_space) return { success: false };
      const destinationPath = suggested_folder ? `${suggested_space}/${suggested_folder}` : suggested_space;
      try {
        if (is_new_space) await createFolder(suggested_space);
        if (suggested_folder && is_new_folder) await createFolder(destinationPath);
        for (const filename of target_files) {
          const fileData = allFilesFlat.find((f) => f.name === filename);
          const fromFolder = fileData?.folder || '';
          await moveFile(filename, fromFolder, destinationPath);
        }
        showToast(`Arquivos organizados em "${destinationPath}".`, 'success');
        refresh('');
        await refreshSpaces();
        return { success: true };
      } catch (err) {
        showToast(err?.response?.data?.detail || 'Erro ao organizar arquivos.');
        return { success: false };
      }
    }
    // Formato antigo (campo plano)    const { suggested_space, is_new_space, suggested_folder, is_new_folder, target_files } = insight;
    if (!suggested_space) return { success: false };

    const destinationPath = suggested_folder
      ? `${suggested_space}/${suggested_folder}`
      : suggested_space;

    try {
      if (is_new_space)  await createFolder(suggested_space);
      if (suggested_folder && is_new_folder) await createFolder(destinationPath);
      for (const filename of target_files) {
        const fileData = allFilesFlat.find((f) => f.name === filename);
        const fromFolder = fileData?.folder || '';
        await moveFile(filename, fromFolder, destinationPath);
      }
      showToast(`Arquivos organizados em "${destinationPath}".`, 'success');
      refresh('');
      await refreshSpaces();
      return { success: true };
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao organizar arquivos.');
      return { success: false };
    }
  };
  // ── Renomear espaço (sidebar) ─────────────────────────────────────────
  const handleRenameSession = useCallback(async (oldName, newName) => {
    try {
      await renameFolder(oldName, newName);
      showToast(`Espaço "${oldName}" renomeado para "${newName}".`, 'success');
      if (activeView === oldName || activeView.startsWith(`${oldName}/`)) {
        handleViewChange(activeView.replace(oldName, newName));
      } else {
        await refreshSpaces();
      }
      loadAllFlat();
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao renomear espaço.');
    }
  }, [activeView, refreshSpaces, loadAllFlat]);

  // ── Renomear subpasta (grid) ─────────────────────────────────────────
  const handleRenameFolder = useCallback(async (navPath, newName) => {
    try {
      await renameFolder(navPath, newName);
      showToast(`Pasta renomeada para "${newName}".`, 'success');
      refresh(currentFolder);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao renomear pasta.');
    }
  }, [currentFolder, refresh]);

  // ── Renomear arquivo ──────────────────────────────────────────────────
  const handleRenameFile = useCallback(async (filename, folder, newName) => {
    try {
      await renameFile(filename, folder, newName, isSharedView ? sharedOwnerId : null);
      showToast(`"${filename}" renomeado para "${newName}".`, 'success');
      refresh(currentFolder);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao renomear arquivo.');
    }
  }, [currentFolder, refresh, isSharedView, sharedOwnerId]);

  // ── Drop externo (arrastar do gerenciador de arquivos) ─────────────────────
  const handleExternalDrop = useCallback(async (fileList, targetFolder) => {
    const existingNames = new Map(allFilesFlat.map((f) => [f.name, f.folder || '']));
    const blocked = [], duplicates = [], valid = [];

    Array.from(fileList).forEach((f) => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (BLOCKED_EXTS.has(ext)) {
        blocked.push(f.name);
      } else if (existingNames.has(f.name)) {
        const loc = existingNames.get(f.name);
        duplicates.push({ name: f.name, folder: loc });
      } else {
        valid.push(f);
      }
    });

    if (blocked.length)
      showToast(`Bloqueado: ${blocked.join(', ')} — tipo de arquivo não permitido.`, 'error');
    if (duplicates.length)
      showToast(`Já existe: ${duplicates.map((d) => d.name).join(', ')}.`, 'error');
    if (!valid.length) return;

    const dest = targetFolder || currentFolder || 'Geral';
    const formData = new FormData();
    valid.forEach((f) => formData.append('files', f));
    try {
      const { data } = await uploadFiles(formData, undefined, dest);
      showToast(`${valid.length} arquivo${valid.length > 1 ? 's adicionados' : ' adicionado'} em "${dest}".`, 'success');
      refresh(currentFolder);
      loadAllFlat();
      if (data.files?.length) {
        try {
          const { data: structure } = await getSpaceStructure();
          const { data: insight } = await getInsights(data.files, structure);
          if (insight?.suggested_space) setPendingInsight(insight);
        } catch { /* insight opcional */ }
      }
    } catch {
      showToast('Erro ao fazer upload dos arquivos.');
    }
  }, [allFilesFlat, currentFolder, refresh, loadAllFlat]);

  // ── Deletar arquivo ────────────────────────────────────────────────────────
  const handleDelete = async (filename, folder = '') => {
    try {
      await deleteFile(filename, folder, isSharedView ? sharedOwnerId : null);
      setItems((prev) => ({ ...prev, files: prev.files.filter((f) => f.name !== filename) }));
      setAllFilesFlat((prev) => prev.filter((f) => f.name !== filename));
      if (!isSharedView) {
        showToast('Arquivo movido para a lixeira.', 'success');
        loadTrashCount();
        loadStorageInfo();  // atualiza cota após excluir
      } else {
        showToast('Arquivo removido.', 'success');
      }
    } catch {
      showToast('Erro ao remover arquivo.');
    }
  };

  // ── Arquivos exibidos ──────────────────────────────────────────────────────
  const displayFiles = (() => {
    let base;
    if (activeView === 'all') {
      base = allFilesFlat;
    } else if (activeView === 'recent') {
      base = allFilesFlat.slice(0, 20);
    } else {
      base = items.files;  // inclui shared views
    }
    if (filenameQuery.trim()) {
      const q = filenameQuery.toLowerCase();
      base = base.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (filterExts.length > 0) {
      base = base.filter((f) => filterExts.includes((f.ext || '').toLowerCase()));
    }
    // Paginação client-side apenas para a view "all" sem filtros
    if (activeView === 'all' && !filenameQuery.trim() && filterExts.length === 0) {
      return base.slice(0, allViewLimit);
    }
    return base;
  })();

  const allViewTotal = (() => {
    if (activeView !== 'all' || filenameQuery.trim() || filterExts.length > 0) return 0;
    return allFilesFlat.length;
  })();

  // Pastas exibidas no grid:
  // - all: subpastas de todos os espaços (espaços ficam só na sidebar)
  // - espaço: subpastas dentro do espaço atual
  // - subpasta / recent: nenhuma
  const displayFolders = (() => {
    if (activeView === 'all') return [];
    if (activeView === 'recent') return [];
    if (isSharedView) return items.folders;  // mostra subpastas do espaço compartilhado (somente leitura)
    if (!isInSubfolder) return items.folders;
    return [];
  })();

  const allFilesCount = allFilesFlat.length;

  // Contagem total de arquivos no espaço atual (recursiva, inclui subpastas)
  const currentSpaceFileCount = currentSpaceName
    ? allFilesFlat.filter((f) => (f.folder || '').split('/')[0] === currentSpaceName).length
    : 0;

  const availableExts = [...new Set(
    allFilesFlat.map((f) => (f.ext || '').toLowerCase()).filter(Boolean)
  )].sort();

  const handleUploadClick = () => {
    if (isSharedViewer) {
      showToast('Você é apenas visualizador neste espaço. Peça ao dono para te tornar editor.', 'error');
      return;
    }
    setShowUpload(true);
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <Header
        onUploadClick={handleUploadClick}
        filenameQuery={filenameQuery}
        onFilenameSearch={setFilenameQuery}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        filterExts={filterExts}
        onFilterExts={setFilterExts}
        availableExts={availableExts}
        user={user}
        onLogout={logout}
        onNavigateToSpace={handleViewChange}
        onInviteResponded={() => { loadSharedSpaces(); }}
        onProfileClick={() => setShowProfile(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          fileCount={allFilesCount}
          onUploadClick={handleUploadClick}
          sessions={allSpaces}
          sharedSpaces={sharedSpaces}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onNotify={showToast}
          onExternalDropToSpace={(files, spaceName) => handleExternalDrop(files, spaceName)}
          storageInfo={storageInfo}
          trashCount={trashCount}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 min-w-0">
          {activeView === 'trash' ? (
            <TrashView
              onNotify={showToast}
              onRestored={() => { loadTrashCount(); loadItems(''); loadAllFlat(); }}
              onDeleted={loadTrashCount}
            />
          ) : (
            <>
            <FileGrid
              files={displayFiles}
              folders={displayFolders}
              allFilesCount={allFilesCount}
              loading={loading}
              activeView={activeView}
              filenameQuery={filenameQuery}
              currentFolder={currentFolder}
              currentSpaceName={isSharedView ? sharedSpaceName : currentSpaceName}
              currentSubfolder={currentSubfolder}
              isInSubfolder={isInSubfolder}
              currentSpaceFileCount={currentSpaceFileCount}
              isReadOnly={isSharedViewer}
              onDelete={handleDelete}
              onUploadClick={handleUploadClick}
              onNavigateFolder={handleNavigateFolder}
              onNavigateBack={handleNavigateBack}
              onNavigateToAll={() => handleViewChange('all')}
              onCreateFolder={handleCreateSubfolder}
              onDeleteFolder={handleDeleteFolder}
              onMoveFile={handleMoveFile}
              onMoveFileTo={handleMoveFileToDestination}
              onRenameFile={handleRenameFile}
              onRenameFolder={handleRenameFolder}
              onFileCreated={() => { refresh(currentFolder); showToast('Arquivo criado com sucesso!', 'success'); }}
              onExternalDrop={handleExternalDrop}
              onPreviewFile={(file) => { setPreviewFile(file); setChatAttachFile({ ...file, _ts: Date.now() }); }}
            />
            {/* Botão "Mostrar mais" para paginação */}
            {allViewTotal > allViewLimit && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  onClick={() => setAllViewLimit((l) => l + 100)}
                  className="px-5 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Mostrar mais ({allViewTotal - allViewLimit} restantes)
                </button>
              </div>
            )}
            </>
          )}
        </main>

        <ChatPanel
          allFiles={allFilesFlat}
          pendingInsight={pendingInsight}
          onApplyInsight={handleApplyInsight}
          onApplyMoves={handleApplyMoves}
          autoAttachFile={chatAttachFile}
          onAgentComplete={() => { refresh(currentFolder); loadAllFlat(); }}
        />
      </div>

      {/* Preview + Chat modal */}
      {previewFile && (
        <PreviewChatModal
          file={previewFile}
          onClose={() => { setPreviewFile(null); setChatAttachFile(null); }}
          onMoveFileTo={handleMoveFileToDestination}
          onRenameFile={handleRenameFile}
          allFiles={allFilesFlat}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium z-50 ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Modal de perfil */}
      {showProfile && (
        <ProfileModal
          onClose={() => setShowProfile(false)}
          onNotify={showToast}
        />
      )}

      {/* Modal de upload */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          folder={currentFolder}
          spaces={allSpaces}
          allFiles={allFilesFlat}
          sharedSpaces={sharedSpaces.filter(s => s.permission === 'editor')}
          uploadOwnerId={isSharedView ? sharedOwnerId : null}
          onSuccess={async (uploadedFiles) => {
            setShowUpload(false);
            refresh(currentFolder);
            loadStorageInfo();   // atualiza barra de cota após upload
            showToast('Upload realizado com sucesso!', 'success');
            if (uploadedFiles && uploadedFiles.length > 0) {
              try {
                const { data: structure } = await getSpaceStructure();
                const { data } = await getInsights(uploadedFiles, structure);
                if (data.message) {
                  const groups = (data.groups || []).map((g) => ({ ...g, status: 'pending' }));
                  setPendingInsight({ ...data, groups, id: Date.now() });
                }
              } catch { /* insight é opcional */ }
            }
          }}
        />
      )}
    </div>
  );
}
