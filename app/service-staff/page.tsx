"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, uniqueChannelTopic } from "../../lib/supabase";
import { useRouter } from "next/navigation";
function formatTableNumber(tableNumber: string | number | null | undefined): string {
  if (tableNumber === null || tableNumber === undefined || tableNumber === "") {
    return "—";
  }

  const str = String(tableNumber).trim();

  if (/^T\d+$/i.test(str)) {
    return str.toUpperCase();
  }

  const num = parseInt(str, 10);

  if (Number.isNaN(num)) {
    return str;
  }

  return `T${String(num).padStart(2, "0")}`;
}

export default function ServiceStaffPage() {
  const router = useRouter();
const [checkingAccess, setCheckingAccess] = useState(true);
  const [readyOrders, setReadyOrders] = useState<any[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);

  const notifiedRequestsRef = useRef(new Set<string>());
  const isFirstRequestLoadRef = useRef(true);

  // --- Add Extra Item state ---
  const [tables, setTables] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [extraCart, setExtraCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
  };

  const loadData = async () => {
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "READY")
      .eq("order_mode", "dine_in")
      .order("created_at", { ascending: true });

if (ordersError) {
  console.error("Failed to load orders:", ordersError);
  alert("Failed to load orders. Please refresh and try again.");
  return;
}
    const orderIds = ordersData.map((order) => order.id);

    const { data: orderItemsData, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        *,
        menu_items (
          name
        )
      `)
      .in("order_id", orderIds.length > 0 ? orderIds : ["00000000-0000-0000-0000-000000000000"]);

    if (itemsError) {
      console.error(itemsError);
      return;
    }

  const { data: tablesData, error: tablesError } = await supabase
  .from("tables")
  .select("id, table_number, current_session_id");

    if (tablesError) {
      console.error(tablesError);
      return;
    }

    const { data: requestsData, error: requestsError } = await supabase
      .from("table_requests")
      .select("*")
      .eq("status", "PENDING")
      .eq("type", "CALL_WAITER")
      .order("created_at", { ascending: true });

    if (requestsError) {
      console.error(requestsError);
      return;
    }

    const tableNumberById = new Map(
      tablesData.map((table) => [table.id, table.table_number])
    );

    const mergedOrders = ordersData.map((order) => ({
      ...order,
      order_items: orderItemsData.filter(
        (item) => item.order_id === order.id
      ),
      table_display: order.table_id
        ? formatTableNumber(tableNumberById.get(order.table_id))
        : "—",
    }));

    const mergedCalls = requestsData.map((request) => ({
      ...request,
      table_display: formatTableNumber(tableNumberById.get(request.table_id)),
    }));

    // Waiter-call sound — once per newly-seen pending call, not on poll
    // refreshes, and not for calls already pending on first page load.
    if (isFirstRequestLoadRef.current) {
      mergedCalls.forEach((request) =>
        notifiedRequestsRef.current.add(request.id)
      );
      isFirstRequestLoadRef.current = false;
    } else {
      const unseenCalls = mergedCalls.filter(
        (request) => !notifiedRequestsRef.current.has(request.id)
      );

      if (soundEnabledRef.current && unseenCalls.length > 0) {
        new Audio("/waiter-call.mp3").play();
      }

      unseenCalls.forEach((request) =>
        notifiedRequestsRef.current.add(request.id)
      );
    }

    setReadyOrders(mergedOrders);
    setWaiterCalls(mergedCalls);
  };

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 5000);

    const ordersChannel = supabase
      .channel(uniqueChannelTopic("service-staff-orders"))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const requestsChannel = supabase
      .channel(uniqueChannelTopic("service-staff-table-requests"))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_requests",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, []);

  // Load tables + menu items once for the "Add Extra Item" form
  useEffect(() => {
    const loadTablesAndMenu = async () => {
      const { data: tablesData, error: tablesError } = await supabase
        .from("tables")
        .select("id, table_number")
        .order("table_number", { ascending: true });

      if (tablesError) {
        console.error(tablesError);
        return;
      }

      const { data: menuItemsData, error: menuItemsError } = await supabase
        .from("menu_items")
        .select("id, name, price")
        .order("name", { ascending: true });

      if (menuItemsError) {
        console.error(menuItemsError);
        return;
      }

      setTables(tablesData);
      setMenuItems(menuItemsData);
    };

    loadTablesAndMenu();
  }, []);


  // "Served" reuses the existing COMPLETED status — no schema change,
  // just a relabeled action moved out of the kitchen dashboard.
const resolveWaiterCall = async (id: string) => {
  const { error } = await supabase
    .from("table_requests")
    .update({ status: "RESOLVED", resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Failed to resolve waiter call:", error);
    alert("Failed to resolve. Please try again.");
    return;
  }
  loadData();
};

const markServed = async (id: string) => {
  const { error } = await supabase
    .from("orders")
    .update({ status: "COMPLETED" })
    .eq("id", id);

  if (error) {
    console.error("Failed to mark order served:", error);
    alert("Failed to mark as served. Please try again.");
    return;
  }
  loadData();
};

  const increaseExtraItem = (id: string) => {
    setExtraCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const decreaseExtraItem = (id: string) => {
    setExtraCart((prev) => {
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

  const extraTotal = menuItems.reduce(
    (sum, item) => sum + (extraCart[item.id] || 0) * item.price,
    0
  );

  const submitExtraOrder = async () => {
    if (!selectedTableId) return;

    const selectedItems = menuItems.filter((item) => extraCart[item.id]);

    if (selectedItems.length === 0) return;

    setSubmitting(true);
    setSubmitStatus("idle");

    const subtotal = selectedItems.reduce(
      (sum, item) => sum + item.price * extraCart[item.id],
      0
    );
const { data: tableRow, error: tableError } = await supabase
  .from("tables")
  .select("status, current_session_id")
  .eq("id", selectedTableId)
  .single();

if (tableError) {
  console.error(tableError);
  setSubmitStatus("error");
  setSubmitting(false);
  return;
}

let sessionId = tableRow?.current_session_id;

if (!sessionId) {
  const { data: newSession, error: sessionError } =
    await supabase
      .from("table_sessions")
      .insert({
        table_id: selectedTableId,
        customer_id: null,
        session_token: crypto.randomUUID(),
        status: "active",
      })
      .select()
      .single();
if (sessionError) {
  if (sessionError.code === "23505") {
    const { data: existing } = await supabase
      .from("table_sessions")
      .select("id")
      .eq("table_id", selectedTableId)
      .eq("status", "active")
      .single();

    sessionId = existing?.id || null;
  } else {
    console.error(sessionError);
    setSubmitStatus("error");
    setSubmitting(false);
    return;
  }
} else {
  await supabase
    .from("tables")
    .update({
      status: "OCCUPIED",
      current_session_id: newSession.id,
    })
    .eq("id", selectedTableId);

  sessionId = newSession.id;
}
}
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_mode: "dine_in",
        status: "NEW",
        table_id: selectedTableId,
        session_id: sessionId,
        customer_name: null,
        phone_number: null,
        delivery_address: null,
        subtotal: subtotal,
        total: subtotal,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error(orderError);
      setSubmitStatus("error");
      setSubmitting(false);
      return;
    }

    const orderItems = selectedItems.map((item) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: extraCart[item.id],
      unit_price: item.price,
      total_price: item.price * extraCart[item.id],
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error(itemsError);
      setSubmitStatus("error");
      setSubmitting(false);
      return;
    }

    setExtraCart({});
    setSelectedTableId("");
    setSubmitStatus("success");
    setSubmitting(false);

    setTimeout(() => setSubmitStatus("idle"), 4000);
  };
useEffect(() => {
  const verifyServing = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/staff/login");
      return;
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("*")
      .eq("email", session.user.email)
      .eq("status", "approved")
      .single();

    if (!staff || staff.role !== "serving") {
      await supabase.auth.signOut();
      router.replace("/staff/login");
      return;
    }

    setCheckingAccess(false);
  };

  verifyServing();
}, [router]);

if (checkingAccess) {
  return (
    <main className="p-6">
      Checking access...
    </main>
  );
}
  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-6">Service Staff Dashboard</h1>

      <div className="mb-4">
        <button
          onClick={() => {
            const newValue = !soundEnabled;
            setSoundEnabled(newValue);
            soundEnabledRef.current = newValue;

            if (newValue) {
              requestNotificationPermission();
              new Audio("/waiter-call.mp3").play();
            }
          }}
          className={`px-4 py-2 rounded text-white ${
            soundEnabled ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {soundEnabled ? "🔔 Notifications ON" : "🔕 Notifications OFF"}
        </button>
      </div>

      {/* WAITER CALLS */}
      <h2 className="text-xl font-bold mb-4">
        🔔 Waiter Calls ({waiterCalls.length})
      </h2>

      <div className="space-y-4 mb-8">
        {waiterCalls.map((request) => (
          <div key={request.id} className="border rounded-xl p-4 bg-amber-50">
            <p><strong>Table:</strong> {request.table_display}</p>
            <p>
              <strong>Requested:</strong>{" "}
              {new Date(request.created_at).toLocaleTimeString()}
            </p>

            <button
              onClick={() => resolveWaiterCall(request.id)}
              className="bg-amber-600 text-white px-4 py-2 rounded mt-4"
            >
              ✅ Resolve
            </button>
          </div>
        ))}
      </div>

      {/* READY ORDERS */}
      <h2 className="text-xl font-bold mb-4">
        🍽 Ready Orders ({readyOrders.length})
      </h2>

      <div className="space-y-4 mb-8">
        {readyOrders.map((order) => (
          <div key={order.id} className="border rounded-xl p-4">
            <p><strong>Order ID:</strong> {order.id}</p>
            {order.order_mode !== "dine_in" ? (
  <>
    <p><strong>Customer:</strong> {order.customer_name}</p>
    <p><strong>Phone:</strong> {order.phone_number}</p>
    <p><strong>Mode:</strong> {order.order_mode}</p>

    {order.delivery_address && (
      <p><strong>Address:</strong> {order.delivery_address}</p>
    )}
  </>
) : (
  <p><strong>Table:</strong> {order.table_display}</p>
)}
            <p><strong>Total:</strong> ₹{order.total}</p>

            {order.order_items?.length > 0 && (
              <div className="mt-3">
                <strong>Items:</strong>

                <ul className="ml-4 mt-2 list-disc">
                  {order.order_items.map((item: any, index: number) => (
                    <li key={index}>
                      {item.menu_items?.name} × {item.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => markServed(order.id)}
              className="bg-green-700 text-white px-4 py-2 rounded mt-4"
            >
              ✅ Mark Served
            </button>
          </div>
        ))}
      </div>

      {/* ADD EXTRA ITEM TO TABLE */}
      <h2 className="text-xl font-bold mb-4">
        ➕ Add Extra Item to Table
      </h2>

      <div className="border rounded-xl p-4 mb-8 bg-white">
        <label className="block mb-2 font-semibold">Table</label>

        <select
          value={selectedTableId}
          onChange={(e) => setSelectedTableId(e.target.value)}
          className="w-full border p-3 rounded mb-4"
        >
          <option value="">Select a table</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {formatTableNumber(table.table_number)}
            </option>
          ))}
        </select>

        <div className="space-y-3">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between border-b pb-2"
            >
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-gray-600">₹{item.price}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => decreaseExtraItem(item.id)}
                  disabled={!extraCart[item.id]}
                  className="bg-gray-200 px-3 py-1 rounded disabled:opacity-40"
                >
                  -
                </button>

                <span>{extraCart[item.id] || 0}</span>

                <button
                  onClick={() => increaseExtraItem(item.id)}
                  className="bg-black text-white px-3 py-1 rounded"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="font-bold text-lg">Total: ₹{extraTotal}</p>

          <button
            onClick={submitExtraOrder}
            disabled={
              submitting || !selectedTableId || extraTotal === 0
            }
            className="bg-blue-600 text-white px-6 py-3 rounded disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send to Kitchen"}
          </button>
        </div>

        {submitStatus === "success" && (
          <p className="text-green-600 mt-3">
            ✅ Extra order sent to the kitchen.
          </p>
        )}

        {submitStatus === "error" && (
          <p className="text-red-600 mt-3">
            ⚠️ Something went wrong. Please try again.
          </p>
        )}
      </div>
    </main>
  );
}