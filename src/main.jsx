import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./styles.css";
// Опциональная тема v3: «Изумруд + Терракот». Активируется через
// <html data-theme="emerald"> или data-theme="emerald-light".
// По умолчанию — старая dark-тема, чтобы не ломать привычный UI.
import "./tokens-emerald.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  </React.StrictMode>
);