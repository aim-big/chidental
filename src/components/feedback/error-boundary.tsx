'use client'

import * as React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/50 p-8 text-center"
        >
          <p className="text-sm font-semibold text-destructive">Something went wrong.</p>
          {this.state.error && (
            <p className="max-w-prose text-xs text-muted-foreground">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
