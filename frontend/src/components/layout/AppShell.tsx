import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { AddEmailDialog } from "../add-email/AddEmailDialog";
import { Icon, type IconName } from "../Icon";
import styles from "./AppShell.module.css";
import { HealthBanner } from "./HealthBanner";

function NavItem({ to, icon, label, short }: { to: string; icon: IconName; label: string; short: string }) {
  const { pathname } = useLocation();
  // The inbox owns both "/" and "/emails/:id".
  const active = to === "/" ? pathname === "/" || pathname.startsWith("/emails") : pathname.startsWith(to);
  return (
    <Link to={to} aria-current={active ? "page" : undefined} className={styles.navItem}>
      <Icon name={icon} />
      <span className={styles.short}>{short}</span>
      <span className={styles.long}>{label}</span>
    </Link>
  );
}

function Brand() {
  return (
    <Link to="/" className={styles.brand} aria-label="Mail Risk Intelligence, inbox">
      <span className={styles.logo} aria-hidden="true" />
      <span className={styles.brandName}>
        Mail Risk <span className="gradient-text">Intelligence</span>
      </span>
    </Link>
  );
}

export function AppShell() {
  const [adding, setAdding] = useState(false);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <nav aria-label="Main" className={styles.nav}>
            <NavItem to="/" icon="inbox" label="Inbox" short="Inbox" />
            <NavItem to="/graph" icon="graph" label="Knowledge graph" short="Graph" />
          </nav>
          <button
            type="button"
            className={`btn btn-primary ${styles.add}`}
            onClick={() => setAdding(true)}
            aria-haspopup="dialog"
          >
            <Icon name="plus" />
            <span className={styles.addLabel}>Add email</span>
          </button>
        </div>
      </header>
      <HealthBanner />
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <AddEmailDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
