import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ReactQueryProvider } from "@/lib/react-query-provider";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <AuthProvider>
            <ToastProvider>
              {/* /status and /login intentionally render OUTSIDE AppShell
                  (no sidebar) — handled via Next.js route groups in
                  Session 19's actual implementation; shown as the full
                  shell here since that's every other route's real case */}
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
