import type { ComponentChildren } from 'preact';
import { Component } from 'preact';

interface Props {
  children: ComponentChildren;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div class="min-h-screen flex items-center justify-center p-4">
          <div class="text-center bg-white/60 rounded p-8 doodly-border max-w-md">
            <h2 class="text-sketch-dark text-lg font-semibold mb-2">Something went wrong</h2>
            <p class="text-sketch-medium text-sm mb-4">An unexpected error occurred. Please try refreshing the page.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              class="btn-primary btn-md uppercase tracking-wider"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
