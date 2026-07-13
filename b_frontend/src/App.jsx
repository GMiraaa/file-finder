import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FileGrid from './components/FileGrid';
import ChatPanel from './components/ChatPanel';
import UploadModal from './components/UploadModal';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { useAuth } from './contexts/AuthContext';
import { useNotifications } from './contexts/NotificationsContext';
import {
  getItems, getAllFiles, deleteFile, deleteFolder,
  moveFile, renameFile, renameFolder, createFolder, getInsights, getSpaceStructure,
} from './services/api';

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
  const [pendingInsight, setPendingInsight] = useState(null);

  const [loading, setLoading]             = useState(true);
  const [showUpload, setShowUpload]       = useState(false);
  // 'all' | 'recent' | 'SpaceName' | 'SpaceName/SubFolder'
  const [activeView, setActiveView]       = useState('all');
  const [filenameQuery, setFilenameQuery] = useState('');
  const [filterExts, setFilterExts]       = useState([]);
  const [toast, setToast]                 = useState(null);
  const [isDark, setIsDark]               = useState(
    () => localStorage.getItem('theme') === 'dark'
  );

  // ── Valores derivados de activeView ────────────────────────────────────────
  const isInSpace     = activeView !== 'all' && activeView !== 'recent';
  const currentFolder = isInSpace ? activeView : '';                          // caminho completo para API
  const pathParts     = currentFolder ? currentFolder.split('/') : [];
  const currentSpaceName    = pathParts[0] || '';                             // 'Financeiro'
  const currentSubfolder    = pathParts[1] || '';                             // 'Relatórios' (se houver)
  const isInSubfolder       = pathParts.length === 2;

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

  const loadItems = useCallback(async (folder = '') => {
    try {
      const { data } = await getItems(folder);
      setItems({ files: data.files || [], folders: data.folders || [] });
      if (!folder) setAllSpaces(data.folders || []);  // root = espaços
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

  useEffect(() => { loadItems(''); loadAllFlat(); }, [loadItems, loadAllFlat]);

  const refresh = useCallback((folder = currentFolder) => {
    loadItems(folder);
    loadAllFlat();
    if (folder !== '') refreshSpaces();
  }, [currentFolder, loadItems, loadAllFlat, refreshSpaces]);

  // ── Navegação unificada ────────────────────────────────────────────────────
  const handleViewChange = useCallback((view) => {
    setFilenameQuery('');
    if (view === 'all' || view === 'recent') {
      setActiveView(view);
      if (currentFolder !== '') {
        setLoading(true);
        loadItems('').finally(() => setLoading(false));
      }
    } else {
      setActiveView(view);
      setLoading(true);
      loadItems(view).finally(() => setLoading(false));
    }
  }, [currentFolder, loadItems]);

  // FolderCard click: em "all" vai para espaço, em espaço vai para subpasta
  const handleNavigateFolder = (name) => {
    if (!isInSpace) {
      handleViewChange(name);                                  // navega para espaço
    } else if (!isInSubfolder) {
      handleViewChange(`${currentSpaceName}/${name}`);         // navega para subpasta
    }
  };

  // Voltar: de subpasta → espaço, de espaço → all
  const handleNavigateBack = () => {
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
      await createFolder(fullPath);
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
      await moveFile(filename, fromFolder, fullToFolder);
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
      await moveFile(filename, fromFolder, toFolder);
      showToast(`"${filename}" movido para "${toFolder || 'raiz'}".`, 'success');
      refresh(currentFolder);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao mover arquivo.');
    }
  }, [currentFolder, refresh]);

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
      await renameFile(filename, folder, newName);
      showToast(`"${filename}" renomeado para "${newName}".`, 'success');
      refresh(currentFolder);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao renomear arquivo.');
    }
  }, [currentFolder, refresh]);
  // ── Deletar arquivo ────────────────────────────────────────────────────────
  const handleDelete = async (filename, folder = '') => {
    try {
      await deleteFile(filename, folder);
      setItems((prev) => ({ ...prev, files: prev.files.filter((f) => f.name !== filename) }));
      setAllFilesFlat((prev) => prev.filter((f) => f.name !== filename));
      showToast('Arquivo removido.', 'success');
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
      base = items.files;
    }
    if (filenameQuery.trim()) {
      const q = filenameQuery.toLowerCase();
      base = base.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (filterExts.length > 0) {
      base = base.filter((f) => filterExts.includes((f.ext || '').toLowerCase()));
    }
    return base;
  })();

  // Pastas exibidas no grid:
  // - all: subpastas de todos os espaços (espaços ficam só na sidebar)
  // - espaço: subpastas dentro do espaço atual
  // - subpasta / recent: nenhuma
  const displayFolders = (() => {
    if (activeView === 'all') return [];
    if (activeView === 'recent') return [];
    if (!isInSubfolder) return items.folders;   // subpastas do espaço atual
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

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <Header
        onUploadClick={() => setShowUpload(true)}
        filenameQuery={filenameQuery}
        onFilenameSearch={setFilenameQuery}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        filterExts={filterExts}
        onFilterExts={setFilterExts}
        availableExts={availableExts}
        user={user}
        onLogout={logout}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          fileCount={allFilesCount}
          onUploadClick={() => setShowUpload(true)}
          sessions={allSpaces}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 min-w-0">
          <FileGrid
            files={displayFiles}
            folders={displayFolders}
            allFilesCount={allFilesCount}
            loading={loading}
            activeView={activeView}
            filenameQuery={filenameQuery}
            currentFolder={currentFolder}
            currentSpaceName={currentSpaceName}
            currentSubfolder={currentSubfolder}
            isInSubfolder={isInSubfolder}
            currentSpaceFileCount={currentSpaceFileCount}
            onDelete={handleDelete}
            onUploadClick={() => setShowUpload(true)}
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
          />
        </main>

        <ChatPanel
          allFiles={allFilesFlat}
          pendingInsight={pendingInsight}
          onApplyInsight={handleApplyInsight}
          onApplyMoves={handleApplyMoves}
        />
      </div>

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

      {/* Modal de upload */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          folder={currentFolder}
          spaces={allSpaces}
          allFiles={allFilesFlat}
          onSuccess={async (uploadedFiles) => {
            setShowUpload(false);
            refresh(currentFolder);
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
