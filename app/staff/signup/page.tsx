"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function StaffSignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("kitchen");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    try {
      setLoading(true);

      const { error: authError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (authError) {
        alert(authError.message);
        return;
      }

      const { error: staffError } =
        await supabase.from("staff").insert([
          {
            name,
            email,
            phone,
            role,
            status: "pending",
          },
        ]);

      if (staffError) {
        alert(staffError.message);
        return;
      }

      alert("Signup submitted. Wait for admin approval.");

      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRole("kitchen");
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Staff Signup
      </h1>

      <input
        className="border p-2 w-full mb-3"
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="border p-2 w-full mb-3"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        className="border p-2 w-full mb-3"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <input
        type="password"
        className="border p-2 w-full mb-3"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <select
        className="border p-2 w-full mb-3"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="kitchen">Kitchen</option>
        <option value="cashier">Cashier</option>
        <option value="serving">Serving</option>
      </select>

      <button
        onClick={handleSignup}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded w-full"
      >
        {loading ? "Creating..." : "Create Account"}
      </button>
    </main>
  );
}