"use client";
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { subscribeToTelemetry } from "@/lib/api-client";

interface Toast { id: string; message: string; variant: "alert" | "info"; }
const ToastContext = createContext<{ toasts: Toast[] }>({ toasts: [] });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // Global — fires regardless of which page you're on, per the
    // elevation vision's explicit requirement: an anomaly on Session
    // 17's page shouldn't require being on Home to notice.
    const channel = subscribeToTelemetry((row) => {
      if (row.fused_score >= 0.65) {  // AI/ML Spec §7.3 alert threshold
        const toast: Toast = {
          id: row.id,
          message: `Alert: fused score ${row.fused_score.toFixed(2)}`,
          variant: "alert",
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 8000);
      }
    });
    return () => { channel.unsubscribe(); };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
            t.variant === "alert" ? "border-danger bg-danger-bg text-danger" : "border-border bg-surface text-text"
          }`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
