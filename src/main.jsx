import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Noto Sans JP',sans-serif", background: "#F8FAFF", color: "#0F172A", gap: 14, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#001B60" }}>予期しないエラーが発生しました</div>
        <div style={{ fontSize: 13, color: "#475569", maxWidth: 420, lineHeight: 1.6 }}>
          ページを再読み込みすると復帰できることがあります。<br />
          繰り返し発生する場合は管理者に連絡してください。
        </div>
        <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#001B60,#1E3A8A)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          再読み込み
        </button>
        {import.meta.env.DEV && (
          <pre style={{ fontSize: 11, color: "#B91C1C", background: "#FEF2F2", padding: 12, borderRadius: 8, maxWidth: 520, overflow: "auto", whiteSpace: "pre-wrap", textAlign: "left" }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        )}
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
