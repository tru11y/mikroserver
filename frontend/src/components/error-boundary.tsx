'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled React error:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg text-center space-y-3">
          <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
          <p className="text-sm text-muted-foreground">
            L&apos;interface a rencontré un problème inattendu.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }
}
