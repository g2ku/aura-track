import React from "react";
import "./styles.css";

// ErrorBoundary — ловит любые ошибки рендера и показывает их на экране.
// Без него — белый/чёрный экран без объяснений.

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // В консоль браузера уйдёт полный stacktrace.
    // eslint-disable-next-line no-console
    console.error("App crashed:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">
              <i className="ti ti-alert-triangle" aria-hidden="true" />
            </div>
            <h1 className="error-boundary-title">Что-то сломалось</h1>
            <p className="error-boundary-message">
              Приложение поймало ошибку. Скопируй текст ниже и пришли разработчику.
            </p>
            <pre className="error-boundary-stack">
{String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
            <button
              className="btn btn-pri"
              onClick={() => { sessionStorage.clear(); window.location.reload(); }}
            >
              <i className="ti ti-refresh" aria-hidden="true" /> Очистить и перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}