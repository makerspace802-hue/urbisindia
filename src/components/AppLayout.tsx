import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { AppHeader } from "./AppHeader";

/**
 * Shared shell for the three public URBIS pages: persistent header plus a
 * short cross-fade between routes so tab switches feel connected.
 */
export function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
