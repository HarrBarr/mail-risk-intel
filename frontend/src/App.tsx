import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { Spinner } from "./components/Spinner";
import { InboxPage } from "./pages/InboxPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// The force-graph bundle is heavy; only load it when the graph is opened.
const GraphPage = lazy(() => import("./pages/GraphPage"));

function PageFallback() {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--c-muted)" }}>
      <Spinner size={20} label="Loading" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<InboxPage />} />
        <Route path="emails/:id" element={<InboxPage />} />
        <Route
          path="graph"
          element={
            <Suspense fallback={<PageFallback />}>
              <GraphPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}
