import { useState, useRef, useCallback } from 'react';
import { X, Upload, Check, AlertCircle, Loader2, FolderOpen } from 'lucide-react';
import { uploadFiles as uploadFilesApi } from '../services/api';
import { getFileTypeInfo, formatFileSize } from '../utils/helpers';

function formatLocation(folder) {
  if (!folder) return 'Geral';
  const parts = folder.split('/');
  return parts.length === 1 ? parts[0] : `${parts[0]} › ${parts.slice(1).join('/')}`;
}

export default function UploadModal({ onClose, onSuccess, folder = '', spaces = [], allFiles = [] }) {
  const [dragOver, setDragOver]         = useState(false);
  const [files, setFiles]               = useState([]);
  const [duplicates, setDuplicates]     = useState([]); // { name, folder }
  const [uploading, setUploading]       = useState(false);
  const [progress, setProgress]         = useState(0);
  const [done, setDone]                 = useState(false);
  const [error, setError]               = useState(null);
  // Seleção de espaço (só quando chamado de "Meus Arquivos", folder === '')
  const [selectedSpace, setSelectedSpace] = useState('');

  const inputRef = useRef(null);

  // Destino efetivo do upload — cai em 'Geral' se nenhum espaço selecionado
  const uploadFolder = folder || selectedSpace || 'Geral';

  const addFiles = useCallback((incoming) => {
    setFiles((prev) => {
      const existingNames = new Set([
        ...allFiles.map((f) => f.name),   // já enviados
        ...prev.map((f) => f.name),        // já enfileirados neste batch
      ]);
      const newDupes = [];
      const allowed = [];
      Array.from(incoming).forEach((f) => {
        if (existingNames.has(f.name)) {
          newDupes.push({ name: f.name, folder: allFiles.find((e) => e.name === f.name)?.folder || '' });
        } else {
          allowed.push({ file: f, name: f.name, size: f.size });
          existingNames.add(f.name); // evita duplicatas dentro do mesmo lote arrastado
        }
      });
      if (newDupes.length)
        setDuplicates((d) => [
          ...d,
          ...newDupes.filter((nd) => !d.some((p) => p.name === nd.name)),
        ]);
      return allowed.length ? [...prev, ...allowed] : prev;
    });
  }, [allFiles]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    files.forEach(({ file }) => formData.append('files', file));

    try {
      const { data } = await uploadFilesApi(formData, (e) => {
        if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
      }, uploadFolder);
      setDone(true);
      setTimeout(() => onSuccess(data.files || []), 1200);
    } catch {
      setError('Erro ao fazer upload. Verifique os arquivos e tente novamente.');
      setUploading(false);
    }
  };

  const isRootView = !folder;
  const canUpload = files.length > 0 && !uploading && !done;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Fazer Upload de Arquivos</h2>
            {!isRootView && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1">
                <FolderOpen className="w-3.5 h-3.5" />
                Espaço: <span className="font-semibold">{folder.split('/')[0]}</span>
                {folder.includes('/') && (
                  <span className="text-gray-400"> / {folder.split('/')[1]}</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4">

          {/* ── Seletor de espaço (somente em "Meus Arquivos") ── */}
          {isRootView && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Selecione um espaço
                </p>
                {!selectedSpace && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                    Padrão: Geral
                  </span>
                )}
              </div>
              {spaces.length === 0 ? (
                <div className="flex items-start gap-2.5 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-700/40 rounded-xl px-3 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs">
                    Nenhum espaço disponível. O arquivo será enviado para o espaço padrão <span className="font-semibold">"Geral"</span>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {spaces.map((space) => (
                    <button
                      key={space.name}
                      onClick={() => setSelectedSpace(prev => prev === space.name ? '' : space.name)}
                      disabled={uploading || done}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left text-sm transition-colors ${
                        selectedSpace === space.name
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <FolderOpen className={`w-4 h-4 flex-shrink-0 ${selectedSpace === space.name ? 'text-indigo-500' : 'text-gray-400'}`} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-xs">{space.name}</p>
                        {space.fileCount > 0 && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">{space.fileCount} arquivo{space.fileCount > 1 ? 's' : ''}</p>
                        )}
                      </div>
                      {selectedSpace === space.name && (
                        <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Zona de drop — sempre ativa (cai em 'Geral' se nenhum espaço selecionado) */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl p-8 text-center transition-colors select-none cursor-pointer
              ${dragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'}
            `}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Arraste arquivos aqui ou{' '}<span className="text-blue-600 underline underline-offset-2">clique para selecionar</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {isRootView && !selectedSpace
                ? <span>Sem espaço selecionado — irá para <span className="font-medium text-indigo-500">Geral</span></span>
                : 'Qualquer tipo de arquivo · Máximo 50 MB por arquivo'}
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* Lista de arquivos selecionados */}
          {files.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {files.map((f, i) => {
                const { icon: Icon, color } = getFileTypeInfo(f.name);
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                    <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-200 truncate font-medium">{f.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{formatFileSize(f.size)}</p>
                    </div>
                    {!uploading && !done && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Arquivos duplicados bloqueados */}
          {duplicates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Arquivos bloqueados — já existem no sistema
              </p>
              {duplicates.map((d) => (
                <div key={d.name} className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{d.name}</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      Já existe em: <span className="font-semibold">{formatLocation(d.folder)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setDuplicates((prev) => prev.filter((p) => p.name !== d.name))}
                    className="p-0.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-colors flex-shrink-0"
                    title="Dispensar aviso"
                  >
                    <X className="w-3.5 h-3.5 text-amber-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Barra de progresso */}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Enviando arquivos{uploadFolder ? ` para "${uploadFolder}"` : ''}...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Sucesso */}
          {done && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 p-3 rounded-xl">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">
                {files.length} {files.length === 1 ? 'arquivo enviado' : 'arquivos enviados'} com sucesso!
              </span>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : (
              <><Upload className="w-4 h-4" /> {files.length > 0 ? `Enviar ${files.length} arquivo${files.length > 1 ? 's' : ''}` : 'Enviar'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
