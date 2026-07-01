import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FileGrid from './components/FileGrid';
import ChatPanel from './components/ChatPanel';
import UploadModal from './components/UploadModal';
import { getFiles, deleteFile } from './services/api';

export default function App() {
  const [allFiles, setAllFiles]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showUpload, setShowUpload]       = useState(false);
  const [activeView, setActiveView]       = useState('all');
  const [filenameQuery, setFilenameQuery] = useState('');
  const [toast, setToast]                 = useState(null);
  const [isDark, setIsDark]               = useState(
    () => localStorage.getItem('theme') === 'dark'
  );

  // Aplica / remove a classe `dark` no <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadFiles = useCallback(async () => {
    try {
      const { data } = await getFiles();
      setAllFiles(data.files || []);
    } catch {
      showToast('Erro ao conectar com o servidor. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleDelete = async (filename) => {
    try {
      await deleteFile(filename);
      setAllFiles((prev) => prev.filter((f) => f.name !== filename));
      showToast('Arquivo removido.', 'success');
    } catch {
      showToast('Erro ao remover arquivo.');
    }
  };

  // Arquivos exibidos: filtrados por nome (se houver query) e pela view ativa
  const displayFiles = (() => {
    let base = activeView === 'recent' ? [...allFiles].slice(0, 20) : allFiles;
    if (filenameQuery.trim()) {
      const q = filenameQuery.toLowerCase();
      base = base.filter((f) => f.name.toLowerCase().includes(q));
    }
    return base;
  })();

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
          onViewChange={(v) => { setActiveView(v); setFilenameQuery(''); }}
          fileCount={allFiles.length}
          onUploadClick={() => setShowUpload(true)}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 min-w-0">
          <FileGrid
            files={displayFiles}
            allFiles={allFiles}
            loading={loading}
            activeView={activeView}
            filenameQuery={filenameQuery}
            onDelete={handleDelete}
            onUploadClick={() => setShowUpload(true)}
          />
        </main>

        <ChatPanel hasFiles={allFiles.length > 0} />
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

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            loadFiles();
            showToast('Upload realizado com sucesso!', 'success');
          }}
        />
      )}
    </div>
  );
}
