import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FileGrid from './components/FileGrid';
import ChatPanel from './components/ChatPanel';
import UploadModal from './components/UploadModal';
import { getItems, getAllFiles, deleteFile, deleteFolder, moveFile, createFolder, getInsights } from './services/api';

export default function App() {
  // Navegação de pastas
  const [currentFolder, setCurrentFolder] = useState('');
  // Items da pasta atual (files + folders)
  const [items, setItems]                 = useState({ files: [], folders: [] });
  // Todos os arquivos (flat) para o chat
  const [allFilesFlat, setAllFilesFlat]   = useState([]);
  const [pendingInsight, setPendingInsight] = useState(null);

  const [loading, setLoading]             = useState(true);
  const [showUpload, setShowUpload]       = useState(false);
  const [activeView, setActiveView]       = useState('all');
  const [filenameQuery, setFilenameQuery] = useState('');
  const [toast, setToast]                 = useState(null);
  const [isDark, setIsDark]               = useState(
    () => localStorage.getItem('theme') === 'dark'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else         { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Carrega items da pasta atual
  const loadItems = useCallback(async (folder = '') => {
    try {
      const { data } = await getItems(folder);
      setItems({ files: data.files || [], folders: data.folders || [] });
    } catch {
      showToast('Erro ao conectar com o servidor. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega todos os arquivos flat para o chat
  const loadAllFlat = useCallback(async () => {
    try {
      const { data } = await getAllFiles();
      setAllFilesFlat(data.files || []);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => { loadItems(''); loadAllFlat(); }, [loadItems, loadAllFlat]);

  // Refresh completo
  const refresh = useCallback((folder = currentFolder) => {
    loadItems(folder);
    loadAllFlat();
  }, [currentFolder, loadItems, loadAllFlat]);

  // Navegação de pastas
  const handleNavigateFolder = (name) => {
    setCurrentFolder(name);
    setFilenameQuery('');
    setLoading(true);
    loadItems(name).finally(() => setLoading(false));
  };
  const handleNavigateBack = () => {
    setCurrentFolder('');
    setFilenameQuery('');
    setLoading(true);
    loadItems('').finally(() => setLoading(false));
  };

  // CRUD pastas
  const handleCreateFolder = async (name) => {
    try {
      await createFolder(name);
      showToast(`Pasta "${name}" criada.`, 'success');
      refresh('');
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao criar pasta.');
    }
  };
  const handleDeleteFolder = async (name) => {
    try {
      await deleteFolder(name);
      showToast(`Pasta "${name}" removida.`, 'success');
      refresh('');
    } catch {
      showToast('Erro ao remover pasta.');
    }
  };

  // Mover arquivo
  const handleMoveFile = async (filename, fromFolder, toFolder) => {
    try {
      await moveFile(filename, fromFolder, toFolder);
      const dest = toFolder ? `"${toFolder}"` : 'raiz';
      showToast(`"${filename}" movido para ${dest}.`, 'success');
      refresh(currentFolder);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao mover arquivo.');
    }
  };

  // Aplicar insight: criar pasta (se nova) e mover arquivos
  const handleApplyInsight = async (insight) => {
    const { suggested_folder, is_new_folder, target_files } = insight;
    try {
      if (is_new_folder) await createFolder(suggested_folder);
      for (const filename of target_files) {
        const fileData = allFilesFlat.find((f) => f.name === filename);
        const fromFolder = fileData?.folder || '';
        await moveFile(filename, fromFolder, suggested_folder);
      }
      showToast(`Arquivos organizados em "${suggested_folder}".`, 'success');
      refresh('');
      return { success: true };
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Erro ao organizar arquivos.');
      return { success: false };
    }
  };

  // Deletar arquivo
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

  // Arquivos exibidos com filtros
  const displayFiles = (() => {
    let base = activeView === 'recent' ? [...items.files].slice(0, 20) : items.files;
    if (filenameQuery.trim()) {
      const q = filenameQuery.toLowerCase();
      base = base.filter((f) => f.name.toLowerCase().includes(q));
    }
    return base;
  })();

  const displayFolders = filenameQuery.trim()
    ? items.folders.filter((f) => f.name.toLowerCase().includes(filenameQuery.toLowerCase()))
    : items.folders;

  const allFilesCount = allFilesFlat.length;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <Header
        onUploadClick={() => setShowUpload(true)}
        filenameQuery={filenameQuery}
        onFilenameSearch={setFilenameQuery}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={(v) => {
            setActiveView(v);
            setFilenameQuery('');
            if (currentFolder) handleNavigateBack();
          }}
          fileCount={allFilesCount}
          onUploadClick={() => setShowUpload(true)}
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
            onDelete={handleDelete}
            onUploadClick={() => setShowUpload(true)}
            onNavigateFolder={handleNavigateFolder}
            onNavigateBack={handleNavigateBack}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveFile={handleMoveFile}
          />
        </main>

        <ChatPanel allFiles={allFilesFlat} pendingInsight={pendingInsight} onApplyInsight={handleApplyInsight} />
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium z-50 ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          folder={currentFolder}
          onSuccess={async (uploadedFiles) => {
            setShowUpload(false);
            refresh(currentFolder);
            showToast('Upload realizado com sucesso!', 'success');
            if (uploadedFiles && uploadedFiles.length > 0) {
              try {
                const folderNames = items.folders.map((f) => f.name);
                const { data } = await getInsights(uploadedFiles, folderNames);
                if (data.message) setPendingInsight({ ...data, id: Date.now() });
              } catch { /* insight é opcional, falha silenciosamente */ }
            }
          }}
        />
      )}
    </div>
  );
}
