import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Algo deu errado
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Um erro inesperado ocorreu. Tente recarregar a página.
          </p>
          {this.state.error?.message && (
            <pre className="text-xs text-left bg-gray-100 dark:bg-gray-800 rounded-xl p-3 mb-5 text-red-600 dark:text-red-400 overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
