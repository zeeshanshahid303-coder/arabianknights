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
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-eyebrow">Arabian Nights</p>
        <h1 className="auth-title">Owner Login</h1>
        <p className="auth-subtitle">
          Restaurant management — owner access
        </p>

        <hr className="auth-rule" />

        <div className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="owner-email">
              Email
            </label>
            <input
              id="owner-email"
              type="email"
              className="auth-input"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="owner-password">
              Password
            </label>
            <input
              id="owner-password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="auth-submit"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>
    </main>
  );
}