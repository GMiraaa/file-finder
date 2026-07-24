import { useCallback, useEffect, useState } from 'react';
import { Trash2, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { getTrashItems, restoreTrashItem, deleteTrashItem, emptyTrash } from '../services/api';
import { getFileTypeInfo, formatFileSize } from '../utils/helpers';
import DeleteConfirmModal from './DeleteConfirmModal';

function daysLeft(expiresAt) {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt) - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

export default function TrashView({ onNotify, onRestored, onDeleted }) {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [restoring, setRestoring]   = useState(null);
  const [deleting, setDeleting]     = useState(null);
  const [emptying, setEmptying]     = useState(false);
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getTrashItems();
      setItems(data.items || []);
    } catch {
      onNotify('Erro ao carregar lixeira.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (id) => {
    setRestoring(id);
    try {
      await restoreTrashItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      onNotify('Arquivo restaurado com sucesso!', 'success');
      onRestored?.();
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao restaurar arquivo.', 'error');
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    setDeleteConfirmId(null);
    try {
      await deleteTrashItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      onNotify('Arquivo excluído permanentemente.', 'success');
      onDeleted?.();
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao excluir arquivo.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleEmptyTrash = async () => {
    setEmptyConfirm(false);
    setEmptying(true);
    try {
      await emptyTrash();
      setItems([]);
      onNotify('Lixeira esvaziada com sucesso!', 'success');
      onDeleted?.();
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao esvaziar lixeira.', 'error');
    } finally {
      setEmptying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Lixeira</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Arquivos excluídos são mantidos por 30 dias
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setEmptyConfirm(true)}
            disabled={emptying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {emptying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Esvaziar lixeira
          </button>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
          <div className="w-44 h-44 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <img src="/Bob-2.png" alt="" aria-hidden="true" className="w-32 select-none" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Lixeira vazia</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum arquivo na lixeira.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const { icon: Icon, color } = getFileTypeInfo(item.filename);
            const days = daysLeft(item.expires_at);
            const urgent = days <= 3;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:shadow-sm transition-shadow"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.filename}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {item.original_folder
                        ? item.original_folder.replace('/', ' › ')
                        : 'Raiz'}
                    </span>
                    {item.size != null && (
                      <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                    )}
                    {item.size != null && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatFileSize(item.size)}</span>
                    )}
                    <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(item.deleted_at)}</span>
                  </div>
                </div>

                {/* Days remaining badge */}
                <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                  urgent
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {urgent && <AlertTriangle className="w-3 h-3" />}
                  {days}d
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(item.id)}
                    disabled={restoring === item.id}
                    className="p-1.5 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 hover:text-green-600 transition-colors"
                    title="Restaurar"
                  >
                    {restoring === item.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <RotateCcw className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    disabled={deleting === item.id}
                    className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                    title="Excluir permanentemente"
                  >
                    {deleting === item.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modais de confirmação */}
      {deleteConfirmId !== null && (
        <DeleteConfirmModal
          fileName={items.find((i) => i.id === deleteConfirmId)?.filename || ''}
          body="Excluir este arquivo permanentemente? Esta ação não pode ser desfeita."
          onConfirm={() => handleDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
      {emptyConfirm && (
        <DeleteConfirmModal
          fileName={`${items.length} arquivo${items.length > 1 ? 's' : ''}`}
          body="Esvaziar a lixeira excluirá permanentemente todos os arquivos. Esta ação não pode ser desfeita."
          onConfirm={handleEmptyTrash}
          onCancel={() => setEmptyConfirm(false)}
        />
      )}
    </div>
  );
}
