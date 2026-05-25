import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster, ToastBar, toast } from "react-hot-toast";
import { X } from "lucide-react";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={(import.meta as any).env?.VITE_BASE_PATH || "/"}>
        <App />
        <Toaster position="top-right">
          {(t) => (
            <ToastBar toast={t}>
              {({ icon, message }) => (
                <>
                  {icon}
                  {message}
                  {t.type !== "loading" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.dismiss(t.id);
                      }}
                      className="ml-2 p-1 rounded-full text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors focus:outline-none cursor-pointer flex items-center justify-center"
                      aria-label="Close"
                    >
                      <X size={14} className="stroke-[2.5]" />
                    </button>
                  )}
                </>
              )}
            </ToastBar>
          )}
        </Toaster>
      </BrowserRouter>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  </React.StrictMode>,
);
