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

export default function KitchenPage() {
  const router = useRouter();
const [checkingAccess, setCheckingAccess] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
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
  loadOrders();

  const interval = setInterval(() => {
    loadOrders();
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
        loadOrders();
      }
    )
    .subscribe();

  return () => {
    clearInterval(interval);
    supabase.removeChannel(channel);
  };
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
    <main className="p-6">
      Checking access...
    </main>
  );
}
return (
  <main className="p-6">
    <h1 className="text-3xl font-bold mb-6">
      Kitchen Dashboard
    </h1>
<div className="mb-4">
  <button
   onClick={() => {
  const newValue = !soundEnabled;

  setSoundEnabled(newValue);
  soundEnabledRef.current = newValue;

if (newValue) {
  requestNotificationPermission();

  new Audio("/notification.mp3").play();
}
}}
    className={`px-4 py-2 rounded text-white ${
      soundEnabled ? "bg-green-600" : "bg-red-600"
    }`}
  >
    {soundEnabled
      ? "🔔 Notifications ON"
      : "🔕 Notifications OFF"}
  </button>
</div>

    {/* NEW */}
    <h2 className="text-xl font-bold mb-4">
      🆕 New Orders ({newOrders.length})
    </h2>

    <div className="space-y-4 mb-8">
      {newOrders.map((order) => (
        <div key={order.id} className="border rounded-xl p-4">
          <p><strong>Order ID:</strong> {order.id}</p>
          <p><strong>Table:</strong> {order.table_display}</p>
          <p><strong>Mode:</strong> {order.order_mode}</p>

          {order.customer_name && (
            <p><strong>Customer:</strong> {order.customer_name}</p>
          )}

          {order.phone_number && (
            <p><strong>Phone:</strong> {order.phone_number}</p>
          )}

          {order.delivery_address && (
            <p><strong>Address:</strong> {order.delivery_address}</p>
          )}

          <p><strong>Total:</strong> ₹{order.total}</p>
{order.order_items?.length > 0 && (
  <div className="mt-3">
    <strong>Items:</strong>

    <ul className="ml-4 mt-2 list-disc">
      {order.order_items.map(
        (item: any, index: number) => (
          <li key={index}>
            {item.menu_items?.name} × {item.quantity}
          </li>
        )
      )}
    </ul>
  </div>
)}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => acceptOrder(order.id)}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              ✅ Accept
            </button>

            <button
              onClick={() => rejectOrder(order.id)}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
             ❌ Reject
</button>
</div>

</div>
))}
</div>

    {/* PREPARING */}
    <h2 className="text-xl font-bold mb-4">
      🍳 Preparing ({preparingOrders.length})
    </h2>

    <div className="space-y-4 mb-8">
      {preparingOrders.map((order) => (
        <div key={order.id} className="border rounded-xl p-4">
          <p><strong>Order ID:</strong> {order.id}</p>
          <p><strong>Table:</strong> {order.table_display}</p>
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
            onClick={() => markReady(order.id)}
            className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
          >
            🍽 Mark Ready
          </button>
        </div>
      ))}
    </div>

{/* READY (read-only — Service Staff owns "Mark Served") */}
<h2 className="text-xl font-bold mb-4">
  🍽 Ready ({readyOrders.length})
</h2>

<div className="space-y-4 mb-8">
  {readyOrders.map((order) => (
    <div key={order.id} className="border rounded-xl p-4 bg-gray-50">
      <p><strong>Order ID:</strong> {order.id}</p>
      <p><strong>Table:</strong> {order.table_display}</p>
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
      {order.order_mode === "dine_in" ? (
        <p className="text-sm text-gray-500 mt-3">
          Waiting for service staff to serve this order.
        </p>
      ) : (
        <button
          onClick={() => markCompleted(order.id)}
          className="bg-green-700 text-white px-4 py-2 rounded mt-4"
        >
          ✅ Mark Completed
        </button>
      )}
    </div>
  ))}
</div>
  </main>
);
}