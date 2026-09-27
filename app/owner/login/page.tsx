"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

// PHASE 1 NOTE: this page performs a real Supabase Auth sign-in, but
// nothing yet PROTECTS /owner/dashboard — there is no session check,
// middleware, or redirect-if-not-authed guard. Anyone who knows the
// URL can currently open the dashboard directly. Route protection is
// explicitly deferred to the security-implementation phase.
export default function OwnerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !data.user) {
      setError(authError?.message || "Invalid email or password.");
      setLoading(false);
      return;
    }

    // Best-effort — updates the owners row's last_login if one exists
    // for this email. Not blocking: a failure here shouldn't stop
    // login. Owner Management's "Active Owners" / "Last Login" display
    // relies on this being kept reasonably fresh.
    await supabase
      .from("owners")
      .update({ last_login: new Date().toISOString() })
      .eq("email", email.trim());

    setLoading(false);
    window.location.href = "/owner/dashboard";
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Owner Login</h1>
        <p className="text-sm text-gray-500 mb-6">
          Restaurant management — owner access
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-3 rounded"
              placeholder="owner@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border p-3 rounded"
              placeholder="••••••••"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-black text-white px-4 py-3 rounded disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>
    </main>
  );
}