import { HardDrive, Plus, Clock } from 'lucide-react';

export default function Sidebar({ activeView, onViewChange, fileCount, onUploadClick }) {
  const navItems = [
    { id: 'all',    icon: HardDrive, label: 'Meus Arquivos', count: fileCount },
    { id: 'recent', icon: Clock,     label: 'Recentes' },
  ];

  return (
    <aside className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col py-3 overflow-y-auto">
      {/* Botão Novo (estilo Google Drive) */}
      <div className="px-3 mb-4">
        <button
          onClick={onUploadClick}
          className="w-full flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:shadow-md active:shadow-sm text-gray-700 dark:text-gray-200 rounded-2xl px-4 py-3 text-sm font-medium transition-shadow dark:hover:bg-gray-700"
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <Plus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          Novo upload
        </button>
      </div>

      {/* Navegação */}
      <nav className="px-3 space-y-0.5">
        {navItems.map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-full text-sm transition-colors ${
              activeView === id
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${activeView === id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500'}`} />
            <span className="flex-1 text-left truncate">{label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  activeView === id
                    ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Rodapé de armazenamento */}
      <div className="mt-auto px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
          {fileCount} {fileCount === 1 ? 'arquivo armazenado' : 'arquivos armazenados'}
        </p>
      </div>
    </aside>
  );
}
