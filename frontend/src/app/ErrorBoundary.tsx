import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ff3b30',
          background: '#fff',
          minHeight: '100vh',
          wordBreak: 'break-word'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️ Xato</div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            {this.state.error?.name}: {this.state.error?.message}
          </div>
          <pre style={{ fontSize: '11px', color: '#666', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: '#2481cc',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Qayta yuklash
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
