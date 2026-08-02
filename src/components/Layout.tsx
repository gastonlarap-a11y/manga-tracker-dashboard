import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { ConnectionBadge } from "./ConnectionBadge";
import { LiveRefresh } from "./LiveRefresh";
import { SyncBadge } from "./SyncBadge";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <LiveRefresh />
      <header className="topbar">
        <span className="brand">Manga Tracker</span>
        <nav>
          <NavLink to="/" end>
            Biblioteca
          </NavLink>
          <NavLink to="/duplicates">Duplicados</NavLink>
        </nav>
        <span className="badges">
          <SyncBadge />
          <ConnectionBadge />
        </span>
      </header>
      <main>{children}</main>
    </div>
  );
}
