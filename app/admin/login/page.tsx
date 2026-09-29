"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("EMAIL:", email);
if (error) {
  console.error(error);

  alert(error.message);

  setLoading(false);

  return;
}
 const { data: adminRow, error: adminError } = await supabase
  .from("admins")
  .select("*")
  .eq("email", email)
  .eq("status", "active")
  .maybeSingle();

if (adminError || !adminRow) {
  await supabase.auth.signOut();
  alert("Not an admin");
  setLoading(false);
  return;
}

router.push("/admin");
    router.push("/admin");
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-eyebrow">Arabian Nights</p>
        <h1 className="auth-title">Admin Login</h1>
        <p className="auth-subtitle">
          Menu and staff administration.
        </p>

        <hr className="auth-rule" />

        <div className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              className="auth-input"
              placeholder="you@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button onClick={handleLogin} disabled={loading} className="auth-submit">
            {loading ? "Loading..." : "Login"}
          </button>
        </div>
      </div>
    </main>
  );
}