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
  const [readyOrders, setReadyOrders] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
  const [waiterCalls, setWaiterCalls] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);

  const notifiedRequestsRef = useRef(new Set<string>());
  const isFirstRequestLoadRef = useRef(true);

  // --- Add Extra Item state ---
  const [tables, setTables] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
  const [menuItems, setMenuItems] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
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
      .in("type", ["CALL_WAITER", "REQUEST_BILL"])
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
    let mounted = true;

    if (mounted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData().catch(console.error);
    }

    const interval = setInterval(() => {
      if (mounted) {
        loadData().catch(console.error);
      }
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
          if (mounted) loadData().catch(console.error);
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
          if (mounted) loadData().catch(console.error);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
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
    <main className="staff-page flex items-center justify-center">
      <p className="staff-title">Checking access...</p>
    </main>
  );
}

  return (
    <main className="staff-page">
      <header className="staff-head">
        <div>
          <p className="eyebrow mb-2 text-gold-gradient">Arabian Knights</p>
          <h1 className="staff-title">Service Staff Dashboard</h1>
        </div>
        <button
          onClick={() => {
            const newValue = !soundEnabled;
            setSoundEnabled(newValue);
            soundEnabledRef.current = newValue;

            if (newValue) {
              requestNotificationPermission();
              new Audio("/waiter-call.mp3").play().catch(console.error);
            }
          }}
          className="staff-btn-outline"
          style={{ alignSelf: 'center', minWidth: '12rem', height: '2.5rem' }}
        >
          {soundEnabled ? "🔔 Notifications ON" : "🔕 Notifications OFF"}
        </button>
      </header>

      <section className="staff-section">
        <div className="staff-section-head">
          <h2 className="staff-section-title">Active Requests</h2>
          <span className="staff-count">{waiterCalls.length}</span>
        </div>

        {waiterCalls.length === 0 ? (
          <p className="text-[var(--color-ivory-faint)] text-sm tracking-wide">No pending requests at the moment.</p>
        ) : (
          <div className="staff-calls-grid">
            {waiterCalls.map((request) => (
              <article
                key={request.id}
                className={"staff-card " + (request.type === "REQUEST_BILL" ? "bill-request" : "")}
              >
                <header className="staff-card-head">
                  <p className="staff-card-table">{request.table_display}</p>
                  <span className={"staff-card-badge " + (request.type === "REQUEST_BILL" ? "bill" : "waiter")}>
                    {request.type === "REQUEST_BILL" ? "Bill Request" : "Waiter Call"}
                  </span>
                </header>

                <div className="staff-card-body">
                  <p className="staff-card-time">
                    Requested: {new Date(request.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>

                  <div className="staff-btn-row">
                    <button
                      onClick={() => resolveWaiterCall(request.id)}
                      className="staff-btn staff-btn-resolve"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="staff-section">
        <div className="staff-section-head">
          <h2 className="staff-section-title">Ready to Serve</h2>
          <span className="staff-count">{readyOrders.length}</span>
        </div>

        {readyOrders.length === 0 ? (
          <p className="text-[var(--color-ivory-faint)] text-sm tracking-wide">No orders waiting to be served.</p>
        ) : (
          <div className="staff-calls-grid">
            {readyOrders.map((order) => (
              <article key={order.id} className="staff-card">
                <header className="staff-card-head">
                  <p className="staff-card-table">
                    {order.order_mode === "dine_in" ? order.table_display : "Takeout"}
                  </p>
                  <span className="staff-card-badge waiter">Order Ready</span>
                </header>

                <div className="staff-card-body">
                  {order.order_mode !== "dine_in" && (
                    <div className="mb-4 text-sm text-[var(--color-ivory)] space-y-1">
                      <p><strong className="text-[var(--color-ivory-muted)] mr-1">Customer:</strong> {order.customer_name || "—"}</p>
                      <p><strong className="text-[var(--color-ivory-muted)] mr-1">Phone:</strong> {order.phone_number || "—"}</p>
                      {order.delivery_address && (
                        <p><strong className="text-[var(--color-ivory-muted)] mr-1">Address:</strong> {order.delivery_address}</p>
                      )}
                    </div>
                  )}

                  {order.order_items?.length > 0 && (
                    <ul className="mb-4 space-y-2">
                      {order.order_items.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, index: number) => (
                        <li key={index} className="staff-card-item">
                          <span className="font-bold text-[var(--color-ivory)] text-sm mr-1">{item.quantity}×</span>
                          <span>{item.menu_items?.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="staff-btn-row">
                    <button
                      onClick={() => markServed(order.id)}
                      className="staff-btn staff-btn-accept"
                    >
                      Confirm Served
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="staff-section">
        <div className="staff-section-head">
          <h2 className="staff-section-title">Add Extra Items</h2>
        </div>

        <div className="staff-form-panel">
          <label className="block mb-2 text-sm uppercase tracking-widest text-[var(--color-ivory-muted)] font-bold">
            Select Table
          </label>

          <select
            value={selectedTableId}
            onChange={(e) => setSelectedTableId(e.target.value)}
            className="staff-control mb-6"
          >
            <option value="">Choose a table...</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {formatTableNumber(table.table_number)}
              </option>
            ))}
          </select>

          <h3 className="text-sm uppercase tracking-widest text-[var(--color-ivory-muted)] font-bold mb-2 mt-4">Menu Items</h3>

          <div className="staff-form-list">
            {menuItems.map((item) => (
              <div key={item.id} className="staff-form-item">
                <div>
                  <p className="font-semibold text-[var(--color-ivory)]">{item.name}</p>
                  <p className="text-sm text-[var(--color-gold)]">₹{item.price}</p>
                </div>

                <div className="staff-qty-ctrl">
                  <button
                    onClick={() => decreaseExtraItem(item.id)}
                    disabled={!extraCart[item.id]}
                    className="staff-btn-outline"
                    style={{ padding: "0.25rem 0.75rem", fontSize: "1rem", height: "2rem" }}
                  >
                    −
                  </button>

                  <span className="staff-qty-val text-[var(--color-ivory)]">{extraCart[item.id] || 0}</span>

                  <button
                    onClick={() => increaseExtraItem(item.id)}
                    className="staff-btn-outline"
                    style={{ background: "rgba(212,175,55,0.1)", borderColor: "var(--color-gold)", color: "var(--color-gold)", padding: "0.25rem 0.75rem", fontSize: "1rem", height: "2rem" }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="staff-total-bar mt-4 border-t border-[var(--color-hairline)] pt-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--color-ivory-muted)] mb-1">Total Amount</p>
              <p className="font-display text-2xl text-[var(--color-gold)] tracking-wide">₹{extraTotal}</p>
            </div>

            <button
              onClick={submitExtraOrder}
              disabled={submitting || !selectedTableId || extraTotal === 0}
              className="staff-btn staff-btn-accept"
              style={{ width: "auto", minWidth: "12rem", height: "3rem" }}
            >
              {submitting ? "Sending..." : "Send Order"}
            </button>
          </div>

          {submitStatus === "success" && (
            <p className="text-[#3bb98a] mt-4 text-sm font-medium tracking-wide">
              ✓ Extra order sent to the kitchen
            </p>
          )}

          {submitStatus === "error" && (
            <p className="text-[#e0503a] mt-4 text-sm font-medium tracking-wide">
              ⚠ Something went wrong. Please try again.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

