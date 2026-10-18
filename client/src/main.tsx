import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ApiError } from "@/api/client";
import { AuthProvider } from "@/context/AuthContext";
import App from "./App";
import "./styles.css";
import { i18nReady } from "./i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry client errors (400/401/403/404) — only network blips and 5xx.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

// Wait for the saved language's strings so the first paint is already in the right language.
void i18nReady.finally(() =>
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
),
);
