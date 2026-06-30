import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FileGrid from './components/FileGrid';
import UploadModal from './components/UploadModal';
import { getFiles, deleteFile, searchFiles } from './services/api';

export default function App() {
  const [allFiles, setAllFiles]         = useState([]);
  const [searchResults, setSearchResults] = useState(null);   // null = sem busca ativa
  const [loading, setLoading]           = useState(true);
  const [searching, setSearching]       = useState(false);
  const [showUpload, setShowUpload]     = useState(false);
  const [activeView, setActiveView]     = useState('all');   // 'all' | 'results' | 'recent'
  const [searchQuery, setSearchQuery]   = useState('');
  const [toast, setToast]               = useState(null);

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

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setSearching(true);
    setActiveView('results');
    setSearchResults(null);
    try {
      const { data } = await searchFiles(query);
      setSearchResults(data.results || []);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Erro ao realizar busca com IA';
      showToast(msg);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchResults(null);
    setSearchQuery('');
    setActiveView('all');
  };

  const handleDelete = async (filename) => {
    try {
      await deleteFile(filename);
      setAllFiles((prev) => prev.filter((f) => f.name !== filename));
      if (searchResults) {
        setSearchResults((prev) => prev.filter((r) => r.name !== filename));
      }
      showToast('Arquivo removido.', 'success');
    } catch {
      showToast('Erro ao remover arquivo.');
    }
  };

  const handleViewChange = (view) => {
    setActiveView(view);
    if (view !== 'results') {
      // Mantém os resultados salvos mas muda a view
    }
  };

  // Arquivos a exibir conforme a view ativa
  const displayFiles = (() => {
    if (activeView === 'results' && searchResults !== null) {
      // Ordena pelos resultados do Gemini (preserva relevância)
      return searchResults
        .map((r) => allFiles.find((f) => f.name === r.name))
        .filter(Boolean);
    }
    if (activeView === 'recent') {
      return [...allFiles].slice(0, 20);
    }
    return allFiles;
  })();

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <Header
        onSearch={handleSearch}
        onUploadClick={() => setShowUpload(true)}
        searching={searching}
        searchQuery={searchQuery}
        onClearSearch={handleClearSearch}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={handleViewChange}
          fileCount={allFiles.length}
          onUploadClick={() => setShowUpload(true)}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-white">
          <FileGrid
            files={displayFiles}
            allFiles={allFiles}
            loading={loading}
            searching={searching}
            searchResults={searchResults}
            activeView={activeView}
            searchQuery={searchQuery}
            onDelete={handleDelete}
            onUploadClick={() => setShowUpload(true)}
          />
        </main>
      </div>

      {/* Toast de notificação */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium z-50 transition-all ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-white'
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
