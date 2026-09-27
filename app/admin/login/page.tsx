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
    <div>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />

      <button onClick={handleLogin}>
        {loading ? "Loading..." : "Login"}
      </button>
    </div>
  );
}