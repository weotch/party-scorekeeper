import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useRevalidator } from "react-router";
import { requireOfficial } from "~/lib/session.server";
import type { Route } from "./+types/app-layout";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOfficial(request);
  return null;
}

/** Keeps every official's screen current: refresh on return to the tab and every 15s while visible. */
function useAutoRefresh() {
  const revalidator = useRevalidator();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && revalidator.state === "idle") {
        revalidator.revalidate();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 15_000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(timer);
    };
  }, [revalidator]);
}

export default function AppLayout() {
  useAutoRefresh();
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-md px-4 pb-28">
        <Outlet />
      </div>
      <nav className="fixed inset-x-0 bottom-0 border-t border-neon-cyan/40 bg-void/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgb(0_240_255/0.12)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-2">
          <Tab to="/" label="Events" />
          <Tab to="/leaderboard" label="Leaderboard" />
        </div>
      </nav>
    </>
  );
}

function Tab({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation();
  return (
    <NavLink
      to={to}
      // "Events" stays highlighted on /events/:position
      className={({ isActive }) =>
        `py-4 text-center font-display text-sm font-bold uppercase tracking-[0.2em] ${
          isActive || (to === "/" && pathname.startsWith("/events"))
            ? "text-neon-cyan text-glow"
            : "text-dim"
        }`
      }
    >
      {label}
    </NavLink>
  );
}
