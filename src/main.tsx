import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LanguageProvider } from "./lib/i18n";
import { ToastProvider } from "./components/ui/Toast";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LanguageProvider>
  </React.StrictMode>
);
