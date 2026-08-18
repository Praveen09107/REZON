// Deliberately does NOT import AppShell (Session 12) — this route
// needs to render with zero auth dependency and zero sidebar, per
// Frontend Spec §5. Closes Session 12's flagged open item about
// route-group separation, now that this page's real structure exists
// to build that separation around.
export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      {children}
    </div>
  );
}
