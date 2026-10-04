import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/toast-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ReactQueryProvider } from "@/lib/react-query-provider";
import "./globals.css";

import { EdgeCopilot } from "@/components/edge-copilot";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ReactQueryProvider>
          <AuthProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
              <EdgeCopilot />
            </ToastProvider>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
