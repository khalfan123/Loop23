import { Component, type ErrorInfo, type ReactNode } from "react";

interface RouteErrorBoundaryProps {
  label: string;
  children: ReactNode;
  resetKey?: string;
}

interface RouteErrorBoundaryState {
  error: Error | null;
  info: ErrorInfo | null;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // eslint-disable-next-line no-console
    console.error(`[RouteErrorBoundary:${this.props.label}] render crashed`, {
      error,
      info,
    });
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (
      prevProps.resetKey !== this.props.resetKey &&
      this.state.error
    ) {
      this.setState({ error: null, info: null });
    }
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="m-6 rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Page crashed ({this.props.label})
          </div>
          <h2 className="text-lg font-semibold mt-1">
            Something threw while rendering this page.
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Copy the error below and send it to support so the offending line can be patched.
          </p>
        </div>
        <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-background/60 p-3 text-xs text-destructive max-h-[60vh]">
          {error.name}: {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
          {info?.componentStack
            ? `\n\nComponent stack:${info.componentStack}`
            : ""}
        </pre>
        <button
          type="button"
          onClick={() => this.setState({ error: null, info: null })}
          className="inline-flex items-center rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          Try again
        </button>
      </div>
    );
  }
}
