import { Component, ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details to console for debugging
    console.error("❌ [ErrorBoundary] Caught error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    this.setState({
      error,
      errorInfo,
    });

    // You can also log to an error reporting service here
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9] p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-red-100 rounded-full p-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-[#8b8475] mb-4">
              Something went wrong
            </h1>

            <p className="text-center text-[#a8a195] mb-6">
              We encountered an unexpected error. Don't worry, your data is
              safe.
            </p>

            {/* Error details (only in development) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <summary className="cursor-pointer text-sm font-medium text-red-800 mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="text-xs text-red-700 space-y-2">
                  <div>
                    <strong>Error:</strong>
                    <pre className="mt-1 whitespace-pre-wrap break-words">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-[10px]">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-[10px]">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col gap-3">
              <Button
                onClick={this.handleReset}
                className="w-full bg-[#8b8475] hover:bg-[#6d6659] text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>

              <Button
                onClick={this.handleReload}
                variant="outline"
                className="w-full border-[#d4cfbe] text-[#8b8475] hover:bg-[#e8e4d9]"
              >
                Reload Page
              </Button>

              <Button
                onClick={this.handleGoHome}
                variant="ghost"
                className="w-full text-[#a8a195] hover:text-[#8b8475] hover:bg-[#e8e4d9]"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Homepage
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
