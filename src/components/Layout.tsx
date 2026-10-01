import { BookOpen, Combine, LibraryBig } from "lucide-react";
import { Activity, type ReactNode } from "react";
import {
  type Location,
  NavLink,
  Outlet,
  ScrollRestoration,
  useMatch,
} from "react-router";
import { ConnectionBadge } from "./ConnectionBadge";
import { EmbedSurface, SettingsButton } from "./EmbedChrome";
import { LiveRefresh } from "./LiveRefresh";
import { SyncBadge } from "./SyncBadge";

/**
 * The library's scroll position is remembered by its path, so it comes back on
 * every way of returning to it — the bar, the back link, the browser's back —
 * and not only on the browser's back, which is all a position remembered per
 * history entry would cover. Every other page opens at its top.
 */
function scrollKey(location: Location): string {
  return location.pathname === "/" ? "/" : location.key;
}

/**
 * The one bar there is. Inside the desktop app the window has no bar of its
 * own while it shows this page, so this one carries the app's settings too.
 * Glass, because it is the navigation layer floating above the content — and
 * the only glass on the page besides the library's toolbar.
 *
 * The library (`library`, the page at "/") is not one of the routed pages: it
 * stays mounted, hidden, while another page is shown (`<Activity>`), so coming
 * back to it is instant — the pages already read, the covers already decoded,
 * the grid where it was left. Unmounted, coming back from Duplicados rebuilt
 * all of it. A prop, because the shell does not import views (App does).
 */
export function Layout({ library }: { library: ReactNode }) {
  const onLibrary = useMatch({ path: "/", end: true }) !== null;

  return (
    <div className="shell">
      <LiveRefresh />
      <EmbedSurface />
      <ScrollRestoration getKey={scrollKey} />
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">
              <BookOpen />
            </span>
            <span className="brand-name">Manga Tracker</span>
          </span>
          {/* No view transition between sections: it delayed the page it
              led to by its whole duration, and the library is kept alive
              precisely so that it can appear at once. */}
          <nav className="nav" aria-label="Secciones">
            <NavLink to="/" end>
              <LibraryBig aria-hidden="true" />
              Biblioteca
            </NavLink>
            <NavLink to="/duplicates">
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
        <Activity mode={onLibrary ? "visible" : "hidden"}>{library}</Activity>
        {!onLibrary && <Outlet />}
      </main>
    </div>
  );
}
