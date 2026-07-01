import { useState, useRef, useCallback } from 'react';
import { X, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { uploadFiles as uploadFilesApi } from '../services/api';
import { getFileTypeInfo, formatFileSize } from '../utils/helpers';

export default function UploadModal({ onClose, onSuccess, folder = '' }) {
  const [dragOver, setDragOver]   = useState(false);
  const [files, setFiles]         = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState(null);

  const inputRef = useRef(null);

  const addFiles = useCallback((incoming) => {
    const list = Array.from(incoming).map((f) => ({ file: f, name: f.name, size: f.size }));
    setFiles((prev) => [...prev, ...list]);
  }, []);

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
      }, folder);
      setDone(true);
      setTimeout(() => onSuccess(data.files || []), 1200);
    } catch {
      setError('Erro ao fazer upload. Verifique os arquivos e tente novamente.');
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Fazer Upload de Arquivos</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-4">
          {/* Zona de drop */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors select-none
              ${dragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Arraste arquivos aqui ou{' '}
              <span className="text-blue-600 underline underline-offset-2">clique para selecionar</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Qualquer tipo de arquivo · Máximo 50 MB por arquivo
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
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600"
                  >
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

          {/* Barra de progresso */}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Enviando arquivos...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
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
            disabled={files.length === 0 || uploading || done}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {files.length > 0
                  ? `Enviar ${files.length} arquivo${files.length > 1 ? 's' : ''}`
                  : 'Enviar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
