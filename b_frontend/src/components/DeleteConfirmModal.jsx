import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useClosingAnimation } from '../hooks/useClosingAnimation';

export default function DeleteConfirmModal({ fileName, onConfirm, onCancel, title = 'Excluir arquivo', body }) {
  const cancelRef = useRef(null);
  const { closing, handleClose } = useClosingAnimation(onCancel);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && handleClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${closing ? 'animate-overlay-hide' : 'animate-overlay'}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5 ${closing ? 'animate-modal-hide' : 'animate-modal'}`}>

        {/* Ícone + cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                {title}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Esta ação não pode ser desfeita
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensagem */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {body ?? (
            <>
              Tem certeza que deseja excluir{' '}
              <span
                className="font-semibold text-gray-800 dark:text-gray-100 break-all"
                title={fileName}
              >
                "{fileName}"
              </span>
              ?
            </>
          )}
        </p>

        {/* Ações */}
        <div className="flex items-center gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 rounded-xl transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
