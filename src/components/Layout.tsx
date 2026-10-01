import { BookOpen, Combine, LibraryBig } from "lucide-react";
import { NavLink, Outlet, ScrollRestoration } from "react-router";
import { ConnectionBadge } from "./ConnectionBadge";
import { EmbedSurface, SettingsButton } from "./EmbedChrome";
import { LiveRefresh } from "./LiveRefresh";
import { SyncBadge } from "./SyncBadge";

/**
 * The one bar there is. Inside the desktop app the window has no bar of its
 * own while it shows this page, so this one carries the app's settings too.
 * Glass, because it is the navigation layer floating above the content — and
 * the only glass on the page besides the library's toolbar.
 */
export function Layout() {
  return (
    <div className="shell">
      <LiveRefresh />
      <EmbedSurface />
      {/* Back from a manga lands where the grid was left, not at the top of a
          library of a hundred and forty covers. */}
      <ScrollRestoration />
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">
              <BookOpen />
            </span>
            <span className="brand-name">Manga Tracker</span>
          </span>
          <nav className="nav" aria-label="Secciones">
            <NavLink to="/" end viewTransition>
              <LibraryBig aria-hidden="true" />
              Biblioteca
            </NavLink>
            <NavLink to="/duplicates" viewTransition>
              <Combine aria-hidden="true" />
              Duplicados
            </NavLink>
          </nav>
          <span className="badges">
            <SyncBadge />
            <ConnectionBadge />
          </span>
          <SettingsButton />
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
