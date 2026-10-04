import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { AppHeader } from "./AppHeader";
import ClockWeatherWidget from "./ClockWeatherWidget";
import HelpBot from "./HelpBot";
import { Footer } from "./Footer";

/**
 * Shared shell for the public URBIS pages: persistent header, a draggable
 * clock/weather widget, the site help bot, a short cross-fade between routes,
 * and the footer.
 */
export function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <ClockWeatherWidget />
      <HelpBot />

      <div className="flex-1">
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

      <Footer />
    </div>
  );
}