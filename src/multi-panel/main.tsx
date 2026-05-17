import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/multi-panel/App";
import { I18nProvider } from "@/shared/contexts/I18nContext";
import { ProviderProvider } from "@/shared/contexts/ProviderContext";
import { SettingsProvider } from "@/shared/contexts/SettingsContext";
import { TooltipProvider } from "@/shared/components/TooltipProvider";
import "@/shared/styles/globals.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found");
}

createRoot(container).render(
  <StrictMode>
    <SettingsProvider>
      <I18nProvider>
        <ProviderProvider>
          <App />
        </ProviderProvider>
        <TooltipProvider />
      </I18nProvider>
    </SettingsProvider>
  </StrictMode>,
);
