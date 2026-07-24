import { useRef, useState } from 'react';
import { X, User, Lock, Trash2, Loader2, Check, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { updateProfile, changePassword, deleteAccount } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useClosingAnimation } from '../hooks/useClosingAnimation';

const TABS = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'password', label: 'Senha',  icon: Lock },
  { id: 'danger',   label: 'Conta',  icon: Trash2 },
];

export default function ProfileModal({ onClose, onNotify }) {
  const { user, updateUser, logout } = useAuth();
  const { closing: isClosing, handleClose } = useClosingAnimation(onClose);
  const overlayRef = useRef(null);

  const [tab, setTab] = useState('profile');

  // ── Perfil ────────────────────────────────────────────────────────────────
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail]       = useState(user?.email || '');
  const [saving, setSaving]     = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const newUsername = username.trim();
    const newEmail    = email.trim();
    if (!newUsername && !newEmail) return;
    if (newUsername === user.username && newEmail === user.email) {
      onNotify('Nenhuma alteração detectada.', 'info');
      return;
    }
    setSaving(true);
    try {
      const { data } = await updateProfile(
        newUsername !== user.username ? newUsername : undefined,
        newEmail    !== user.email    ? newEmail    : undefined,
      );
      updateUser(data.user, data.access_token, data.refresh_token);
      onNotify('Perfil atualizado com sucesso!', 'success');
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao atualizar perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Senha ─────────────────────────────────────────────────────────────────
  const [currentPwd, setCurrentPwd]   = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showCur, setShowCur]         = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConf, setShowConf]       = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      onNotify('As senhas não coincidem.', 'error');
      return;
    }
    if (newPwd.length < 6) {
      onNotify('A nova senha deve ter ao menos 6 caracteres.', 'error');
      return;
    }
    setChangingPwd(true);
    try {
      const { data } = await changePassword(currentPwd, newPwd);
      updateUser(data.user, data.access_token, data.refresh_token);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      onNotify('Senha alterada com sucesso!', 'success');
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao alterar senha.', 'error');
    } finally {
      setChangingPwd(false);
    }
  };

  // ── Excluir conta ─────────────────────────────────────────────────────────
  const [deletePwd, setDeletePwd]       = useState('');
  const [showDeletePwd, setShowDeletePwd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]           = useState(false);

  const canDelete = deleteConfirm === user?.username && deletePwd.length > 0;

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!canDelete) return;
    setDeleting(true);
    try {
      await deleteAccount(deletePwd);
      logout();
    } catch (err) {
      onNotify(err?.response?.data?.detail || 'Erro ao excluir conta.', 'error');
      setDeleting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && handleClose()}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4
        ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
    >
      <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden
        ${isClosing ? 'animate-scale-down' : 'animate-scale-up'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-base font-bold text-blue-600 dark:text-blue-400 uppercase">
                {user?.username?.[0] || '?'}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user?.username}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 -mb-px
                ${tab === id
                  ? id === 'danger'
                    ? 'border-red-500 text-red-600 dark:text-red-400'
                    : 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">

          {/* ── Aba Perfil ── */}
          {tab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Nome de usuário
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </form>
          )}

          {/* ── Aba Senha ── */}
          {tab === 'password' && (
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <PwdField
                label="Senha atual"
                value={currentPwd}
                onChange={setCurrentPwd}
                show={showCur}
                onToggle={() => setShowCur((v) => !v)}
              />
              <PwdField
                label="Nova senha"
                value={newPwd}
                onChange={setNewPwd}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                hint="Mínimo de 6 caracteres"
              />
              <PwdField
                label="Confirmar nova senha"
                value={confirmPwd}
                onChange={setConfirmPwd}
                show={showConf}
                onToggle={() => setShowConf((v) => !v)}
                error={confirmPwd && newPwd !== confirmPwd ? 'As senhas não coincidem.' : ''}
              />
              <button
                type="submit"
                disabled={changingPwd || !currentPwd || !newPwd || !confirmPwd}
                className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {changingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {changingPwd ? 'Alterando…' : 'Alterar senha'}
              </button>
            </form>
          )}

          {/* ── Aba Conta (perigo) ── */}
          {tab === 'danger' && (
            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4">
              <div className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                  Esta ação é <strong>irreversível</strong>. Todos os seus arquivos,
                  espaços e dados serão permanentemente excluídos.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Digite <span className="font-bold text-gray-800 dark:text-gray-200">{user?.username}</span> para confirmar
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={user?.username}
                  autoComplete="off"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <PwdField
                label="Sua senha"
                value={deletePwd}
                onChange={setDeletePwd}
                show={showDeletePwd}
                onToggle={() => setShowDeletePwd((v) => !v)}
              />

              <button
                type="submit"
                disabled={!canDelete || deleting}
                className="mt-1 flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Excluindo…' : 'Excluir minha conta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PwdField({ label, value, onChange, show, onToggle, hint = '', error = '' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="current-password"
          className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 transition-colors
            ${error
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            }`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error  && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
