"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, uniqueChannelTopic } from "../../lib/supabase";
import { useRouter } from "next/navigation";
// Formats a raw table_number value ("1", 1, or already "T01") into "T01" style.
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

/* How long ago an order was placed, in whole minutes, read off the
   `created_at` the kitchen already has. Display only — it decides
   nothing about an order, it only decides how loudly the ticket is
   asking to be read. */
function orderAgeMinutes(createdAt: string | null | undefined): number {
  if (!createdAt) return 0;
  const placed = new Date(createdAt).getTime();
  if (Number.isNaN(placed)) return 0;
  return Math.max(0, Math.floor((Date.now() - placed) / 60000));
}

/* Three voices, not thirty. Under five minutes is on time and stays
   plain gold; five to ten wants a second look; past ten the ticket
   should be findable from across the pass. */
function ageBand(minutes: number): "normal" | "warning" | "critical" {
  if (minutes >= 10) return "critical";
  if (minutes >= 5) return "warning";
  return "normal";
}

/* The same age, written the way a cook says it out loud. */
function formatAgeLabel(minutes: number): string {
  if (minutes < 1) return "NOW";
  return `${minutes} MIN`;
}

/* One ticket. The three lanes differ only in which actions they offer
   and how the head is drawn, so the card is built once and given its
   lane's colours — a cook who knows one lane's cards knows all three. */
function OrderCard({
  order,
  lane,
  onAccept,
  onReject,
  onReady,
  onComplete,
}: {
  order: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  lane: "new" | "preparing" | "ready";
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onReady?: (id: string) => void;
  onComplete?: (id: string) => void;
}) {
  const minutes = orderAgeMinutes(order.created_at);
  const band = ageBand(minutes);
  const isDineIn = order.order_mode === "dine_in";

  /* The one place a lane's actions are decided, so a card can never
     offer a step that does not belong to where it is sitting. */
  let actions: React.ReactNode = null;
  let footnote: string | null = null;

  if (lane === "new") {
    actions = (
      <>
        <button
          onClick={() => onAccept?.(order.id)}
          className="kitchen-btn"
          data-action="accept"
        >
          Accept
        </button>

        <button
          onClick={() => onReject?.(order.id)}
          className="kitchen-btn"
          data-action="reject"
        >
          Reject
        </button>
      </>
    );
  } else if (lane === "preparing") {
    actions = (
      <button
        onClick={() => onReady?.(order.id)}
        className="kitchen-btn"
        data-action="ready"
      >
        Mark Ready
      </button>
    );
  } else if (isDineIn) {
    /* READY, dine-in — read-only. Service Staff owns "Mark Served". */
    footnote = "Service staff will serve";
  } else {
    actions = (
      <button
        onClick={() => onComplete?.(order.id)}
        className="kitchen-btn"
        data-action="complete"
      >
        Mark Completed
      </button>
    );
  }

  return (
    <article className="kitchen-card" data-age={band} data-lane={lane}>
      <header className="kitchen-card-head">
        <p
          className="kitchen-table"
          data-mode={isDineIn ? "dine_in" : "delivery"}
        >
          {order.table_display}
        </p>

        <span
          className="kitchen-age"
          title={`Placed ${minutes} minute${minutes === 1 ? "" : "s"} ago`}
        >
          {formatAgeLabel(minutes)}
        </span>
      </header>

      <div className="kitchen-card-sub">
        <span>
          {order.order_mode === "dine_in" ? "Dine In" : order.order_mode}
        </span>

        {order.customer_name && <strong>{order.customer_name}</strong>}

        {order.phone_number && <span>{order.phone_number}</span>}
      </div>

      {order.delivery_address && (
        <p className="kitchen-card-note">{order.delivery_address}</p>
      )}

      {order.order_items?.length > 0 && (
        <ul className="kitchen-items">
          {order.order_items.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, index: number) => (
            <li className="kitchen-item" key={index}>
              <span
                className="kitchen-item-qty"
                data-qty={(item.quantity ?? 0) >= 4 ? "many" : "some"}
              >
                {item.quantity}×
              </span>

              <span className="kitchen-item-name">
                {item.menu_items?.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {actions ? (
        <div className="kitchen-actions">{actions}</div>
      ) : footnote ? (
        <p className="kitchen-handoff">{footnote}</p>
      ) : null}
    </article>
  );
}

/* A lane: its own name, its own count, and one grid of tickets under
   it. Counted from the same array it renders, so the number in the
   header can never disagree with the cards below it. */
function Lane({
  lane,
  name,
  orders,
  renderCard,
}: {
  lane: "new" | "preparing" | "ready";
  name: string;
  orders: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  renderCard: (order: any) => React.ReactNode; // eslint-disable-line @typescript-eslint/no-explicit-any
}) {
  return (
    <section className="kitchen-lane" data-lane={lane}>
      <div className="kitchen-lane-head">
        <span className="kitchen-lane-dot" aria-hidden />

        <h2 className="kitchen-lane-name">{name}</h2>

        <span className="kitchen-lane-count">{orders.length}</span>
      </div>

      {orders.length === 0 ? (
        <p className="kitchen-lane-empty">Nothing waiting</p>
      ) : (
        <div className="kitchen-grid">{orders.map(renderCard)}</div>
      )}
    </section>
  );
}

export default function KitchenPage() {
  const router = useRouter();
const [checkingAccess, setCheckingAccess] = useState(true);
  const [orders, setOrders] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
const [soundEnabled, setSoundEnabled] = useState(false);
const soundEnabledRef = useRef(false);
const notifiedOrdersRef = useRef(new Set<string>());
const requestNotificationPermission = async () => {
  if ("Notification" in window) {
    await Notification.requestPermission();
  }
};
const loadOrders = async () => {
  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.error(ordersError);
    return;
  }
const orderIds = (ordersData ?? []).map((o) => o.id);
const { data: orderItemsData, error: itemsError } = await supabase
  .from("order_items")
  .select(`
    *,
    menu_items (
      name
    )
  `)
  .in(
    "order_id",
    orderIds.length > 0
      ? orderIds
      : ["00000000-0000-0000-0000-000000000000"]
  );
  if (itemsError) {
    console.error(itemsError);
    return;
  }

  const { data: tablesData, error: tablesError } = await supabase
    .from("tables")
    .select("id, table_number");

  if (tablesError) {
    console.error(tablesError);
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

const newCount = mergedOrders.filter(
  (order) => order.status === "NEW"
).length;

const currentNewOrders = mergedOrders.filter(
  (order) => order.status === "NEW"
);

const unseenOrders = currentNewOrders.filter(
  (order) => !notifiedOrdersRef.current.has(order.id)
);

if (
  soundEnabledRef.current &&
  unseenOrders.length > 0
) {
  new Audio("/notification.mp3").play();

  unseenOrders.forEach((order) =>
    notifiedOrdersRef.current.add(order.id)
  );

  if (Notification.permission === "granted") {
    new Notification("🍽 New Order Received!", {
      body: "A new order has arrived in the kitchen.",
    });
  }
}
setOrders(mergedOrders);
};
useEffect(() => {
  let mounted = true;
  if (mounted) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders().catch(console.error);
  }

  const interval = setInterval(() => {
    if (mounted) {
      loadOrders().catch(console.error);
    }
  }, 5000);

  const channel = supabase
    .channel(uniqueChannelTopic("kitchen-orders"))
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
      },
      () => {
        if (mounted) loadOrders().catch(console.error);
      }
    )
    .subscribe();

  return () => {
    mounted = false;
    clearInterval(interval);
    supabase.removeChannel(channel);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const acceptOrder = async (id: string) => {
  const { error } = await supabase
    .from("orders")
    .update({ status: "PREPARING" })
    .eq("id", id);

  if (error) {
    console.error("Failed to accept order:", error);
    alert("Failed to update order. Please try again.");
    return;
  }
  loadOrders();
};

const rejectOrder = async (id: string) => {
  const reason = prompt(
    "Reason?\n\n1. Out of stock\n2. Outside delivery area\n3. Kitchen busy\n4. Restaurant closed\n5. Other"
  );

  if (!reason) return;

  const { error } = await supabase
    .from("orders")
    .update({
      status: "CANCELLED",
      rejection_reason: reason,
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to reject order:", error);
    alert("Failed to reject order. Please try again.");
    return;
  }

  loadOrders();
};
 const markReady = async (id: string) => {
  const { error } = await supabase
    .from("orders")
    .update({ status: "READY" })
    .eq("id", id);

  if (error) {
    console.error("Failed to mark ready:", error);
    alert("Failed to mark order ready.");
    return;
  }

  loadOrders();
};
const markCompleted = async (id: string) => {
  const { error } = await supabase
    .from("orders")
    .update({ status: "COMPLETED" })
    .eq("id", id);

  if (error) {
    console.error("Failed to mark completed:", error);
    alert("Failed to complete order.");
    return;
  }

  loadOrders();
};
  const newOrders = orders.filter(
    (order) => order.status === "NEW"
  );
const preparingOrders = orders.filter(
  (order) => order.status === "PREPARING"
);

const readyOrders = orders.filter(
  (order) => order.status === "READY"
);
useEffect(() => {
  const verifyKitchen = async () => {
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

    if (!staff || staff.role !== "kitchen") {
      await supabase.auth.signOut();
      router.replace("/staff/login");
      return;
    }

    setCheckingAccess(false);
  };

  verifyKitchen();
}, [router]);

if (checkingAccess) {
  return (
    <main className="kitchen-page flex items-center justify-center">
      <p className="kitchen-title">Checking access...</p>
    </main>
  );
}

  return (
    <main className="kitchen-page">
      <header className="kitchen-head">
        <div>
          <p className="eyebrow mb-2 text-gold-gradient">Arabian Knights</p>
          <h1 className="kitchen-title">Kitchen Display</h1>
        </div>
        <button
          onClick={() => {
            const newValue = !soundEnabled;
            setSoundEnabled(newValue);
            soundEnabledRef.current = newValue;
            if (newValue) {
              requestNotificationPermission();
              new Audio("/notification.mp3").play().catch(console.error);
            }
          }}
          className="kitchen-btn"
          data-action={soundEnabled ? "accept" : "reject"}
          style={{ flex: "0 0 auto", minWidth: "13rem", padding: "0 1.25rem" }}
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? "Sound On 🔊" : "Sound Off 🔇"}
        </button>
      </header>
      <Lane lane="new" name="New Orders" orders={newOrders}
        renderCard={(order) => (
          <OrderCard key={order.id} order={order} lane="new"
            onAccept={acceptOrder} onReject={rejectOrder} />
        )} />
      <Lane lane="preparing" name="Preparing" orders={preparingOrders}
        renderCard={(order) => (
          <OrderCard key={order.id} order={order} lane="preparing"
            onReady={markReady} />
        )} />
      <Lane lane="ready" name="Ready" orders={readyOrders}
        renderCard={(order) => (
          <OrderCard key={order.id} order={order} lane="ready"
            onComplete={markCompleted} />
        )} />
    </main>
  );
}
