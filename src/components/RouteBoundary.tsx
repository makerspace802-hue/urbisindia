import { Component, type ErrorInfo, type ReactNode } from "react";
import { Home, RotateCw, TriangleAlert } from "lucide-react";
import { Link } from "react-router";

/**
 * Is this a failed module fetch rather than a genuine crash?
 *
 * "Failed to fetch dynamically imported module" means the browser asked for a
 * chunk the server no longer serves — the tab is running a stale build. It is
 * common right after a deploy, and after a Convex codegen changes the shape of
 * `_generated/api`, which every lazily-loaded page imports.
 */
function isStaleChunkError(error: Error): boolean {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    error.message ?? "",
  );
}

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the visitor knows which view gave up. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Per-route error boundary.
 *
 * A throw inside a page used to take down the whole tree and leave the preview
 * on a bare stack trace, losing the header, the navigation and any chance of
 * moving to another page. Each route is now wrapped individually, so a failure
 * in the analytics charts cannot strand someone on the command centre.
 *
 * `key` on the boundary resets it: navigating away and back remounts the
 * wrapper, which clears the error without any manual bookkeeping.
 */
export class RouteBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A genuine crash, so console.error is the right call here — this is the one
    // place in the app where the developer genuinely wants the detail.
    console.error(
      `[RouteBoundary] ${this.props.label ?? "route"} crashed:`,
      error,
      info.componentStack,
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A stale chunk cannot be fixed by re-rendering: React.lazy caches the
    // rejected import, so retrying re-requests the same missing module and
    // fails identically forever. The only cure is a fresh document load, which
    // re-resolves every import against the current build.
    const staleChunk = isStaleChunkError(error);

    const onRetry = () => {
      if (staleChunk) {
        window.location.reload();
        return;
      }
      this.setState({ error: null });
    };

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="nb-panel max-w-md p-6 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center border-2 border-[var(--nb-ink)] bg-[#FBBF24]">
            <TriangleAlert className="size-6 text-[#1A1400]" strokeWidth={3} />
          </div>

          <h2 className="nb-title text-xl">Oops! Something went sideways</h2>

          <p className="mt-2 text-sm font-bold text-[var(--nb-text-muted)]">
            {staleChunk ? (
              <>
                This browser tab is running an older version of URBIS, so a
                file it needs is no longer served. Reloading picks up the
                current version.
              </>
            ) : (
              <>
                {this.props.label
                  ? `The ${this.props.label} view could not be displayed.`
                  : "This view could not be displayed."}{" "}
                The rest of URBIS is still working — try again, or head back to
                the command centre.
              </>
            )}
          </p>

          <p className="mt-3 border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-3 py-2 text-left text-[11px] font-bold text-[var(--nb-text-muted)] break-words">
            {error.message}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="nb-btn bg-[#10B981] text-[#04110C]"
            >
              <RotateCw className="size-4" strokeWidth={3} />
              {staleChunk ? "Reload URBIS" : "Try again"}
            </button>
            <Link to="/" className="nb-btn bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]">
              <Home className="size-4" strokeWidth={3} />
              Command centre
            </Link>
          </div>
        </div>
      </div>
    );
  }
}