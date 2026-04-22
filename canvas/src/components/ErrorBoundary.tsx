import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches render errors and shows a recovery UI
 * instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '1rem',
            padding: '2rem',
            color: '#e0e0e0',
            backgroundColor: '#1e1e1e',
          }}
        >
          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: '0.8rem', color: '#888', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering.'}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              backgroundColor: '#44B2FF',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '0.5rem 1.5rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
