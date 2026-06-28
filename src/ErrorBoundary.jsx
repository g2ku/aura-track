import React from "react";

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
        <div style={{
          minHeight: "100vh",
          background: "#0f1115",
          color: "#e7ebf3",
          padding: "40px 20px",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h1 style={{ color: "#e84c4c", marginBottom: 12 }}>
              Что-то сломалось
            </h1>
            <p style={{ color: "#9ba3b5", marginBottom: 16 }}>
              Приложение поймало ошибку. Скопируй текст ниже и пришли разработчику.
            </p>
            <pre style={{
              background: "#161922",
              border: "1px solid #262b3a",
              borderRadius: 8,
              padding: 16,
              overflow: "auto",
              fontSize: 12,
              color: "#e7ebf3",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
{String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => { sessionStorage.clear(); window.location.reload(); }}
              style={{
                marginTop: 16,
                padding: "10px 18px",
                background: "#4f8cff",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Очистить и перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}