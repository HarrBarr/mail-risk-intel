import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { AddEmailDialog } from "../add-email/AddEmailDialog";
import { Icon, type IconName } from "../Icon";
import { HealthBanner } from "./HealthBanner";

function NavItem({ to, icon, label, short }: { to: string; icon: IconName; label: string; short: string }) {
  const { pathname } = useLocation();
  // The inbox owns both "/" and "/emails/:id".
  const active = to === "/" ? pathname === "/" || pathname.startsWith("/emails") : pathname.startsWith(to);
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <Icon name={icon} />
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function AppShell() {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-4 sm:gap-4">
          <NavLinkBrand />
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavItem to="/" icon="inbox" label="Inbox" short="Inbox" />
            <NavItem to="/graph" icon="graph" label="Knowledge graph" short="Graph" />
          </nav>
          <div className="ml-auto">
            <button
              type="button"
              className="btn-primary px-2.5 sm:px-3"
              onClick={() => setAdding(true)}
              aria-haspopup="dialog"
            >
              <Icon name="plus" />
              <span className="sr-only sm:not-sr-only">Add email</span>
            </button>
          </div>
        </div>
      </header>
      <HealthBanner />
      <main id="main" className="min-h-0 flex-1">
        <Outlet />
      </main>
      <AddEmailDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function NavLinkBrand() {
  return (
    <Link
      to="/"
      className="mr-1 flex items-center gap-2 rounded-md"
      aria-label="Mail Risk Intelligence, inbox"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
        <Icon name="shield" className="h-4 w-4" />
      </span>
      <span className="hidden text-base font-semibold tracking-tight text-slate-900 md:inline">
        Mail Risk Intelligence
      </span>
    </Link>
  );
}
