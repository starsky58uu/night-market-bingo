import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

/* Top-level Error Boundary：app 任何地方 throw 都顯示錯誤訊息而不是白屏 */
class TopErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[App crash]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32,
          fontFamily: 'monospace',
          color: '#c00',
          background: '#fff',
          minHeight: '100vh',
        }}>
          <h2 style={{ marginTop: 0 }}>App crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.stack ?? this.state.error)}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TopErrorBoundary>
      <App />
    </TopErrorBoundary>
  </StrictMode>,
);
