import React, { Component, ErrorInfo, ReactNode } from "react";
import { tryRecoverFromChunkError } from "./utils/staleChunkRecovery";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Fallback path: the primary defense is the vite:preloadError listener in
    // index.tsx, which intercepts a stale-chunk failure before it ever
    // reaches render. This only matters if some failure gets here without
    // going through that — a no-op for any error that isn't a recognized,
    // not-yet-attempted chunk-load failure.
    tryRecoverFromChunkError(error);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-100">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Something went wrong.</h1>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
