import { useEffect, useRef, useState } from 'react';
import { X, Check, UserPlus, Trash2, Mail, Loader2, Users, Pencil, AlertTriangle } from 'lucide-react';
import { getSpaceMembers, inviteToSpace, removeMember, cancelInvite, renameFolder } from '../services/api';

/**
 * Modal unificado para configurações de espaço:
 *  - Renomear espaço
 *  - Convidar usuário por e-mail
 *  - Ver e remover membros / cancelar convites pendentes
 *  - Excluir espaço (zona de perigo)
 *
 * Props:
 *   spaceName      — nome atual do espaço
 *   onClose()
 *   onRenamed(oldName, newName)
 *   onDeleted(spaceName)
 *   onNotify(msg, type)
 */
function PermissionBadge({ perm }) {
  const isEditor = perm === 'editor';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
      isEditor
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }`}>
      {isEditor ? 'Editor' : 'Viewer'}
    </span>
  );
}

export default function SpaceSettingsModal({ spaceName, onClose, onRenamed, onDeleted, onNotify }) {
  const overlayRef = useRef(null);

  // ── Rename ────────────────────────────────────────────────────────────────
  const [renameValue, setRenameValue] = useState(spaceName);
  const [renaming, setRenaming]       = useState(false);

  // ── Invite ────────────────────────────────────────────────────────────────
  const [email, setEmail]             = useState('');
  const [permission, setPermission]   = useState('viewer');
  const [inviting, setInviting]       = useState(false);

  // ── Members ───────────────────────────────────────────────────────────────
  const [members, setMembers]             = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const { data } = await getSpaceMembers(spaceName);
      setMembers(data.members || []);
      setPendingInvites(data.pending_invites || []);
    } catch {
      onNotify('Erro ao carregar membros.', 'error');
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => { loadMembers(); }, [spaceName]);

  // Fechar ao clicar no overlay
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRename = async (e) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === spaceName) return;
    setRenaming(true);
    try {
      await renameFolder(spaceName, trimmed);
      onNotify(`Espaço renomeado para "${trimmed}".`, 'success');
      onRenamed(spaceName, trimmed);
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao renomear espaço.', 'error');
    } finally {
      setRenaming(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setInviting(true);
    try {
      await inviteToSpace(spaceName, trimmed, permission);
      onNotify(`Convite enviado para ${trimmed}.`, 'success');
      setEmail('');
      loadMembers();
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao enviar convite.', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId, username) => {
    try {
      await removeMember(spaceName, memberId);
      onNotify(`"${username}" removido do espaço.`, 'success');
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao remover membro.', 'error');
    }
  };

  const handleCancelInvite = async (inviteId, invEmail) => {
    try {
      await cancelInvite(spaceName, inviteId);
      onNotify(`Convite para ${invEmail} cancelado.`, 'success');
      setPendingInvites((prev) => prev.filter((i) => i.invite_id !== inviteId));
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao cancelar convite.', 'error');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      onDeleted(spaceName);   // App.handleDeleteSession faz a chamada de API + navegação
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Configurações do espaço
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">

          {/* ── Renomear ─────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Pencil className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Nome do espaço
              </h3>
            </div>
            <form onSubmit={handleRename} className="flex gap-2">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={48}
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={renaming || !renameValue.trim() || renameValue.trim() === spaceName}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar
              </button>
            </form>
          </section>

          {/* ── Convidar ─────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Compartilhar com usuário
              </h3>
            </div>
            <form onSubmit={handleInvite} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail do usuário..."
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400"
                />
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="text-sm px-2 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="viewer">Visualizador</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting || !email.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Enviar convite
              </button>
            </form>
          </section>

          {/* ── Membros ──────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Quem tem acesso
              </h3>
            </div>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : members.length === 0 && pendingInvites.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-600 italic py-2">
                Nenhum usuário com acesso ainda.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{m.username}</p>
                        <PermissionBadge perm={m.permission} />
                      </div>
                      <p className="text-xs text-gray-400 truncate">{m.email}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.id, m.username)}
                      className="ml-3 flex-shrink-0 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remover acesso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}

                {pendingInvites.map((inv) => (
                  <li
                    key={inv.invite_id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{inv.email}</p>
                        <PermissionBadge perm={inv.permission} />
                      </div>
                      <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">
                        Convite pendente
                      </span>
                    </div>
                    <button
                      onClick={() => handleCancelInvite(inv.invite_id, inv.email)}
                      className="ml-3 flex-shrink-0 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                      title="Cancelar convite"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* ── Zona de exclusão ───────────────────────────────────────── */}
          <section className="border-t border-red-100 dark:border-red-900/30 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider">
                Zona de exclusão
              </h3>
            </div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Excluir espaço
              </button>
            ) : (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-3">
                <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                  Todos os arquivos e pastas de <strong>"{spaceName}"</strong> serão removidos. Essa ação não pode ser desfeita.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Excluir mesmo assim
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
