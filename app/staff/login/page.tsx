"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function StaffLoginPage() {
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

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const { data: staff, error: staffError } =
      await supabase
        .from("staff")
        .select("*")
        .eq("email", email)
        .single();

    if (staffError || !staff) {
      await supabase.auth.signOut();
      alert("Staff account not found");
      setLoading(false);
      return;
    }

   if (staff.status !== "approved") {
  await supabase.auth.signOut();
  alert(
    staff.status === "pending"
      ? "Waiting for admin approval"
      : staff.status === "inactive"
      ? "Account disabled"
      : "Your access request was rejected"
  );
  setLoading(false);
  return;
}

    if (staff.role === "kitchen") {
      router.push("/kitchen");
    } else if (staff.role === "serving") {
      router.push("/service-staff");
    } else if (staff.role === "cashier") {
  router.push("/cash-counter");
}

    setLoading(false);
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="auth-eyebrow">Arabian Nights</p>
        <h1 className="auth-title">Staff Login</h1>
        <p className="auth-subtitle">
          Kitchen, service and counter access.
        </p>

        <hr className="auth-rule" />

        <div className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="staff-email">
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              className="auth-input"
              placeholder="you@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="staff-password">
              Password
            </label>
            <input
              id="staff-password"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="auth-submit"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    </main>
  );
}