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
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Staff Login
      </h1>

      <input
        className="border p-2 w-full mb-3"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        className="border p-2 w-full mb-3"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </main>
  );
}