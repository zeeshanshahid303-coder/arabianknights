"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
export default function StaffManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
const [checkingAccess, setCheckingAccess] =
  useState(true);
  const loadStaff = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    }

    setStaff(data || []);
    setLoading(false);
  };
useEffect(() => {
  const initialize = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/admin/login");
      return;
    }

    const { data: admin } = await supabase
      .from("admins")
      .select("*")
      .eq("email", session.user.email)
      .eq("status", "active")
      .single();
console.log("SESSION:", session);
console.log("ADMIN:", admin);
    if (!admin) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    setCheckingAccess(false);
    loadStaff();
  };

  initialize();
}, [router]);

  const pendingStaff = staff.filter(
    (s) => s.status === "pending"
  );

  const approvedStaff = staff.filter(
    (s) => s.status === "approved"
  );

  const inactiveStaff = staff.filter(
    (s) => s.status === "inactive"
  );
if (checkingAccess) {
  return (
    <main className="p-6">
      Checking access...
    </main>
  );
}
  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        Staff Management
      </h1>
<h2 className="text-xl font-bold mb-3">
  Pending Staff ({pendingStaff.length})
</h2>

<div className="space-y-3">
  {pendingStaff.map((member) => (
    <div
      key={member.id}
      className="border rounded-lg p-4"
    >
      <p><strong>{member.name}</strong></p>
      <p>{member.email}</p>
      <p>Role: {member.role}</p>

      <button
        onClick={async () => {
          await supabase
            .from("staff")
            .update({ status: "approved" })
            .eq("id", member.id);

          loadStaff();
        }}
        className="bg-green-600 text-white px-3 py-1 rounded mr-2"
      >
        Approve
      </button>

      <button
        onClick={async () => {
          await supabase
            .from("staff")
            .update({ status: "rejected" })
            .eq("id", member.id);

          loadStaff();
        }}
        className="bg-red-600 text-white px-3 py-1 rounded"
      >
        Reject
      </button>
    </div>
  ))}
</div>

<h2 className="text-xl font-bold mt-8 mb-3">
  Approved Staff ({approvedStaff.length})
</h2>

<div className="space-y-3">
  {approvedStaff.map((member) => (
    <div
      key={member.id}
      className="border rounded-lg p-4"
    >
      <p><strong>{member.name}</strong></p>
      <p>{member.email}</p>
      <p>Role: {member.role}</p>

      <button
        onClick={async () => {
          await supabase
            .from("staff")
            .update({ status: "inactive" })
            .eq("id", member.id);

          loadStaff();
        }}
        className="bg-yellow-600 text-white px-3 py-1 rounded"
      >
        Deactivate
      </button>
    </div>
  ))}
</div>

<h2 className="text-xl font-bold mt-8 mb-3">
  Inactive Staff ({inactiveStaff.length})
</h2>

<div className="space-y-3">
  {inactiveStaff.map((member) => (
    <div
      key={member.id}
      className="border rounded-lg p-4"
    >
      <p><strong>{member.name}</strong></p>
      <p>{member.email}</p>
      <p>Role: {member.role}</p>

      <button
        onClick={async () => {
          await supabase
            .from("staff")
            .update({ status: "approved" })
            .eq("id", member.id);

          loadStaff();
        }}
        className="bg-blue-600 text-white px-3 py-1 rounded"
      >
        Activate
      </button>
    </div>
  ))}
</div>
    </main>
  );
}