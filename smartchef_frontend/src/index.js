import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AppStateProvider } from "./state/AppStateContext";
import { logEnvDiagnostics } from "./config/env";

// One-time, non-intrusive diagnostics to help detect missing/mis-shaped env wiring.
// This should never block rendering.
try {
  logEnvDiagnostics();
} catch {
  // ignore
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppStateProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppStateProvider>
  </React.StrictMode>
);
