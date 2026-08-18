"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else alert("Check your email for the sign-in link.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <form onSubmit={handleMagicLink} className="w-80 space-y-4 rounded-lg border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold text-text">REZON</h1>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" required
          className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-text"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="w-full rounded bg-calm px-3 py-2 text-bg font-medium">
          Send sign-in link
        </button>
      </form>
    </div>
  );
}
