import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { LocationProvider } from "@/components/LocationProvider";
import { RouteBoundary } from "@/components/RouteBoundary";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { SettingsProvider } from "@/components/SettingsProvider";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const CommandCenter = lazy(() => import("./pages/CommandCenter.tsx"));
const Analytics = lazy(() => import("./pages/Analytics.tsx"));
const ReportPortal = lazy(() => import("./pages/ReportPortal.tsx"));
const QuizPage = lazy(() => import("./pages/QuizPage.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <SettingsProvider>
        <LocationProvider>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteSkeleton />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<RouteBoundary label="command centre"><CommandCenter /></RouteBoundary>} />
                <Route path="/analytics" element={<RouteBoundary label="analytics"><Analytics /></RouteBoundary>} />
                <Route path="/report" element={<RouteBoundary label="report"><ReportPortal /></RouteBoundary>} />
                <Route path="/quiz" element={<RouteBoundary label="quiz"><QuizPage /></RouteBoundary>} />
              </Route>
              <Route
                path="/auth"
                element={<RouteBoundary label="sign in"><AuthPage redirectAfterAuth="/dashboard" /></RouteBoundary>}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <RouteBoundary label="dashboard"><Dashboard /></RouteBoundary>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<RouteBoundary label="page"><NotFound /></RouteBoundary>} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
        </LocationProvider>
        </SettingsProvider>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
