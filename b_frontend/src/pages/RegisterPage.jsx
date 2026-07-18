import { useState } from 'react';
import { Files, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage({ onGoLogin }) {
  const { register, confirmAuth, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const result = await register(username.trim(), email.trim(), password);
    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => confirmAuth(result.user, result.token, result.refreshToken), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
            <Files className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
            File<span className="text-blue-500">Finder</span>
          </span>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-800">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">Criar conta</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Crie sua conta para começar a usar o FileFinder.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                Nome de usuário
              </label>
              <input
                autoFocus
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="meu_usuario"
                required
                minLength={3}
                maxLength={50}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="mt-1 text-[11px] text-gray-400">Mínimo 3 caracteres. Letras, números, _ e -.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {success && (
              <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-3">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">Conta criada com sucesso!</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Redirecionando para a página inicial...</p>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || success}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar conta
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
            Já tem uma conta?{' '}
            <button onClick={onGoLogin} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              Entrar
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
