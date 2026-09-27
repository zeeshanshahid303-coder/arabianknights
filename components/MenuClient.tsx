"use client";

import { useEffect, useState } from "react";
import { supabase, uniqueChannelTopic } from "../lib/supabase";
export default function MenuClient({
  items,
  categories,
}: {
  items: any[];
  categories: any[];
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
const [dineInSession, setDineInSession] = useState<{
  tableNumber: string;
  tableToken: string;
} | null>(null);

const [waiterCallStatus, setWaiterCallStatus] = useState<
  "idle" | "loading" | "sent" | "error"
>("idle");

const [billRequestStatus, setBillRequestStatus] = useState<
  "idle" | "loading" | "sent" | "error"
>("idle");

// Session-scoped bill state. `table_sessions.bill_requested` is the
// source of truth (not localStorage), so this always reflects the
// CURRENT session for this table — a new customer at the same table
// gets a fresh session row (bill_requested defaults to false, reset
// explicitly on Mark Paid too) and never inherits a prior guest's state.
const [billRequested, setBillRequested] = useState(false);
const [sessionComplete, setSessionComplete] = useState(false);
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");

    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    localStorage.setItem(
      "menuItems",
      JSON.stringify(items)
    );
  }, [items]);
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  const mode = params.get("mode");
  const table = params.get("table");
  const token = params.get("token");

  if (mode) {
    localStorage.setItem("orderMode", mode);
  }
if (mode === "takeaway" || mode === "delivery") {
  localStorage.removeItem("tableNumber");
  localStorage.removeItem("tableToken");
}
  if (table) {
    localStorage.setItem("tableNumber", table);
  }

  if (token) {
    localStorage.setItem("tableToken", token);
  }
const resolvedTable = table;
const resolvedToken = token;
if (resolvedTable && resolvedToken) {
  localStorage.setItem("orderMode", "dine_in");

  setDineInSession({
    tableNumber: resolvedTable,
    tableToken: resolvedToken,
  });
}
}, []);
// Looks up the physical table row (by table_number + qr_token) so we can
// read its current_session_id. Always re-fetched live — never cached in
// localStorage — so we never act on a stale session.
const getTableRow = async () => {
  if (!dineInSession) return null;

  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("table_number", dineInSession.tableNumber)
    .eq("qr_token", dineInSession.tableToken)
    .single();

  if (error) {
    console.error(error);
  }

  return data;
};

// Refreshes bill/session state for the table's CURRENT session:
// - billRequested comes straight from table_sessions.bill_requested
// - sessionComplete is true only once every non-cancelled order in this
//   session is COMPLETED (orders table only ever has NEW/COMPLETED)
const loadSessionState = async () => {
  const tableRow = await getTableRow();

  if (!tableRow?.current_session_id) {
    setBillRequested(false);
    setSessionComplete(false);
    return;
  }

  const { data: sessionRow } = await supabase
    .from("table_sessions")
    .select("bill_requested")
    .eq("id", tableRow.current_session_id)
    .single();

  setBillRequested(Boolean(sessionRow?.bill_requested));

  const { data: sessionOrders } = await supabase
    .from("orders")
    .select("id, status")
    .eq("session_id", tableRow.current_session_id)
    .neq("status", "CANCELLED");

  setSessionComplete(
    Boolean(sessionOrders?.length) &&
   (sessionOrders ?? []).every(
  (order) => order.status === "COMPLETED"
)
  );
};

useEffect(() => {
  if (!dineInSession) return;

  loadSessionState();

  // Keep this in sync live: an order finishing in the kitchen, or the
  // session being ended at the cash counter, should update the button
  // here without requiring the customer to refresh. This is also what
  // gives the NEXT customer at this table a fresh Request Bill button:
  // once staff ends the session and starts a new one, table_sessions
  // changes fire this listener, current_session_id points at the new
  // (bill_requested = false) row, and billRequested/sessionComplete
  // reset accordingly.
  const channel = supabase
    .channel(uniqueChannelTopic(`menu-session-${dineInSession.tableNumber}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      loadSessionState
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "table_sessions" },
      loadSessionState
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [dineInSession]);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const increase = (id: string) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const decrease = (id: string) => {
    setCart((prev) => {
      const qty = (prev[id] || 0) - 1;

      if (qty <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }

      return {
        ...prev,
        [id]: qty,
      };
    });
  };
const callWaiter = async () => {
  if (!dineInSession) return;

  setWaiterCallStatus("loading");

  const { data: tableData } = await supabase
    .from("tables")
    .select("*")
    .eq("table_number", dineInSession.tableNumber)
    .eq("qr_token", dineInSession.tableToken)
    .single();

  if (!tableData?.id) {
    setWaiterCallStatus("error");
    return;
  }

  const { error } = await supabase
    .from("table_requests")
    .insert({
      table_id: tableData.id,
      type: "CALL_WAITER",
      status: "PENDING",
    });

  if (error) {
    console.error(error);
  }

  setWaiterCallStatus("sent");

  setTimeout(() => {
    setWaiterCallStatus("idle");
  }, 60000);
};

const requestBill = async () => {
  // Only allowed once orders are complete, and only once per session —
  // both are enforced again here even though the button is also hidden/
  // disabled in the UI for these cases, since this can still be called
  // programmatically or from a stale render.
  if (!dineInSession || !sessionComplete || billRequested) return;

  setBillRequestStatus("loading");

  const tableRow = await getTableRow();

  if (!tableRow?.id || !tableRow?.current_session_id) {
    setBillRequestStatus("error");
    return;
  }

  // The .eq("bill_requested", false) guard makes this update atomic at
  // the DB level: if two taps race (or the button is tapped twice before
  // state updates), only the first one actually flips the flag. The
  // loser just falls through to re-reading real state below.
  const { data: updatedSession, error: sessionError } = await supabase
    .from("table_sessions")
    .update({
      bill_requested: true,
      bill_requested_at: new Date().toISOString(),
    })
    .eq("id", tableRow.current_session_id)
    .eq("bill_requested", false)
    .select()
    .single();

  if (sessionError || !updatedSession) {
    // Either a real error, or someone already requested the bill for
    // this session. Either way, trust the DB over local state.
    await loadSessionState();
    setBillRequestStatus("idle");
    return;
  }

  // Best-effort: also drop a table_requests row purely so the Cash
  // Counter's existing sound/notification logic fires. bill_requested on
  // table_sessions is the real source of truth, so we don't block or
  // fail the flow if this insert has an issue.
  const { error: requestInsertError } = await supabase
    .from("table_requests")
    .insert({
      table_id: tableRow.id,
      session_id: tableRow.current_session_id,
      type: "REQUEST_BILL",
      status: "PENDING",
    });

  if (requestInsertError) {
    console.error(requestInsertError);
  }

  setBillRequested(true);
  setBillRequestStatus("sent");
};
  const cartCount = Object.values(cart).reduce(
    (sum, qty) => sum + qty,
    0
  );

  return (
    <>
{dineInSession && (
  <div className="flex gap-3 mb-6">
    <button
      onClick={callWaiter}
      disabled={
        waiterCallStatus === "loading" ||
        waiterCallStatus === "sent"
      }
      className="bg-amber-600 text-white px-4 py-2 rounded"
    >
      {waiterCallStatus === "sent"
        ? "🔔 Waiter Notified"
        : "🔔 Call Waiter"}
    </button>

    {/* Only appears once every order in this session is COMPLETED.
        Once requested, stays "Bill Requested" — backed by
        table_sessions.bill_requested, so it survives a refresh and
        never resets until the session actually ends (Mark Paid resets
        bill_requested on the session row, and the next session starts
        fresh at false). */}
    {sessionComplete && (
      <button
        onClick={requestBill}
        disabled={billRequestStatus === "loading" || billRequested}
        className="bg-slate-700 text-white px-4 py-2 rounded disabled:opacity-70"
      >
        {billRequested
          ? "🧾 Bill Requested ✅"
          : billRequestStatus === "loading"
          ? "Requesting..."
          : "🧾 Request Bill"}
      </button>
    )}
  </div>
)}
      {cartCount > 0 && (
        <a
          href="/cart"
          className="fixed bottom-5 right-5 bg-black text-white px-5 py-3 rounded-full shadow-lg z-50"
        >
          🛒 Cart ({cartCount})
        </a>
      )}

      {categories.map((category) => (
        <div key={category.id} className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">
            {category.name}
          </h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items
              .filter(
                (item) => item.category_id === category.id
              )
              .map((item) => (
                <div
                  key={item.id}
                  className="border rounded-xl p-4 shadow-md bg-white"
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  )}

                  <h3 className="font-bold text-lg">
                    {item.name}
                  </h3>

                  <p className="text-gray-600 mt-2">
                    {item.description}
                  </p>

                  <p className="font-semibold text-xl mt-3">
                    ₹{item.price}
                  </p>

                  {item.is_sold_out ? (
                    <button
                      disabled
                      className="mt-4 bg-gray-400 text-white px-4 py-2 rounded"
                    >
                      Currently Unavailable
                    </button>
                  ) : cart[item.id] ? (
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() => decrease(item.id)}
                        className="bg-gray-200 px-3 py-1 rounded"
                      >
                        -
                      </button>

                      <span>{cart[item.id]}</span>

                      <button
                        onClick={() => increase(item.id)}
                        className="bg-black text-white px-3 py-1 rounded"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => increase(item.id)}
                      className="mt-4 bg-black text-white px-4 py-2 rounded"
                    >
                      Add
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </>
  );
}