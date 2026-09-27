"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
async function resolveSessionId(
  tableId: string,
  tableRow: any
): Promise<string | null> {

  if (
    tableRow?.status === "OCCUPIED" &&
    tableRow?.current_session_id
  ) {
    return tableRow.current_session_id;
  }
const {
  data: { user },
} = await supabase.auth.getUser();

  const { data: newSession, error: sessionError } =
    await supabase
      .from("table_sessions")
.insert({
  table_id: tableId,
  customer_id: user?.id,
  session_token: crypto.randomUUID(),
  status: "active",
})
   .select()
    .single();

  if (sessionError) {

        if (sessionError.code === "23505") {
      // Read the winner's session directly from table_sessions instead of
      // waiting on its separate follow-up write to `tables` — that write
      // is a second, independent statement that may not have committed
      // yet, which is exactly what produced session_id = null under a
      // concurrent double-submit.
      const { data: existingSession } = await supabase
        .from("table_sessions")
        .select("id")
        .eq("table_id", tableId)
        .eq("status", "active")
        .single();

      return existingSession?.id || null;
    }

    console.error(sessionError);
    return null;
  }

  await supabase
    .from("tables")
    .update({
      status: "OCCUPIED",
      current_session_id: newSession.id,
    })
    .eq("id", tableId);

  return newSession.id;
}
export default function CartPage() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
const [customerName, setCustomerName] = useState("");
const [phoneNumber, setPhoneNumber] = useState("");
const [deliveryAddress, setDeliveryAddress] = useState("");
const [orderMode, setOrderMode] = useState("dine_in");
const [tableNumber, setTableNumber] = useState<string | null>(null);
const [tableToken, setTableToken] = useState<string | null>(null);
const [orderPlaced, setOrderPlaced] = useState(false);
useEffect(() => {
    const savedCart = localStorage.getItem("cart");

    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    const savedItems = localStorage.getItem("menuItems");

    if (savedItems) {
      setItems(JSON.parse(savedItems));
    }
    setOrderMode(
  localStorage.getItem("orderMode") || "dine_in"
);

setTableNumber(
  localStorage.getItem("tableNumber")
);

setTableToken(
  localStorage.getItem("tableToken")
);
  }, []);

  const cartItems = items.filter((item) => cart[item.id]);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * cart[item.id],
    0
  );

  const totalItems = cartItems.reduce(
    (sum, item) => sum + cart[item.id],
    0
  );

const placeOrder = async () => {
  if (loading) return;

  if (
    orderMode !== "dine_in" &&
    (!customerName.trim() || !phoneNumber.trim())
  ) {
    alert("Please enter name and phone number");
    return;
  }

  if (
    orderMode === "delivery" &&
    !deliveryAddress.trim()
  ) {
    alert("Please enter delivery address");
    return;
  }

  setLoading(true);

  try {
let tableId = null;
let sessionId: string | null = null;

if (tableNumber && tableToken) {
  const { data: tableData, error: tableError } = await supabase
    .from("tables")
    .select("*")
    .eq("table_number", tableNumber)
    .eq("qr_token", tableToken)
    .single();

  if (tableError || !tableData) {
    alert("Could not verify your table. Please rescan the QR code and try again.");
    return;
  }

  tableId = tableData.id;
  sessionId = await resolveSessionId(tableId, tableData);

  if (!sessionId) {
    alert("Could not start your table session. Please try again.");
    return;
  }
}

const {
  data: { session }
} = await supabase.auth.getSession();
const { data: dbItems, error: priceError } = await supabase
  .from("menu_items")
  .select("id, price, is_available")
  .in("id", cartItems.map((i) => i.id));

if (priceError || !dbItems) {
  alert("Could not verify prices. Please try again.");
  return;
}

const verifiedSubtotal = cartItems.reduce((sum, item) => {
  const dbItem = dbItems.find((i) => i.id === item.id)!;
  return sum + dbItem.price * cart[item.id];
}, 0);
const { data: order, error: orderError } = await supabase
  .from("orders")
  .insert({
    order_mode: orderMode,
    status:
      orderMode === "dine_in"
        ? "NEW"
        : "PENDING_APPROVAL",
  customer_name:
    orderMode === "dine_in"
      ? null
      : customerName,

  phone_number:
    orderMode === "dine_in"
      ? null
      : phoneNumber,

  delivery_address:
    orderMode === "delivery"
      ? deliveryAddress
      : null,
subtotal: verifiedSubtotal,
table_id: tableId,
session_id: sessionId,
total: verifiedSubtotal,
})
        .select()
        .single();
if (orderError) {
  console.error("Order insert failed:", orderError);
  alert("Failed to place order. Please try again.");
  return;
}
const orderItems = cartItems.map((item) => {
  const dbPrice = dbItems.find((i) => i.id === item.id)!.price;

  return {
    order_id: order.id,
    menu_item_id: item.id,
    quantity: cart[item.id],
    unit_price: dbPrice,
    total_price: dbPrice * cart[item.id],
  };
});
const { error: itemsError } = await supabase
  .from("order_items")
  .insert(orderItems);
if (itemsError) {
  console.error("Order items insert failed:", itemsError);

  // Delete orphaned order
  await supabase
    .from("orders")
    .delete()
    .eq("id", order.id);

  alert("Failed to place order. Please try again.");
  return;
}
localStorage.removeItem("cart");

setCart({});
if (orderMode === "dine_in" && tableNumber && tableToken) {
  window.location.href = `/menu?table=${tableNumber}&token=${tableToken}`;
} else if (orderMode === "dine_in") {
  window.location.href = "/menu";
} else {
  setOrderPlaced(true);
}
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-4xl font-bold mb-8">
        Your Cart
      </h1>

<a

  href={
    orderPlaced
      ? "/"
      : orderMode === "dine_in" && tableNumber && tableToken
      ? `/menu?table=${tableNumber}&token=${tableToken}`
      : "/menu"
  }
  className="inline-block mb-6 bg-gray-200 px-4 py-2 rounded"
>
  {orderPlaced ? "← Back to Home" : "← Back to Menu"}
</a>

      {orderPlaced && (
        <p className="mb-6 text-green-700 font-semibold">
          ✅ Order requested successfully. We will start processing your{" "}
          {orderMode === "delivery" ? "delivery" : "takeaway"} order shortly.
        </p>
      )}

      {orderPlaced ? null : cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="border rounded-xl p-4"
              >
                <h2 className="font-bold">
                  {item.name}
                </h2>

                <p>
                  Quantity: {cart[item.id]}
                </p>

                <p>
                  ₹{item.price} × {cart[item.id]}
                </p>

                <p className="font-semibold">
                  ₹{item.price * cart[item.id]}
                </p>
              </div>
            ))}
          </div>
<div className="mt-6 space-y-4">
  {orderMode !== "dine_in" && (
    <>
      <input
        type="text"
        placeholder="Customer Name"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        className="w-full border p-3 rounded"
      />
                <input
        type="text"
        placeholder="Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        className="w-full border p-3 rounded"
      />

      <p className="text-sm text-gray-500">
        Please enter correct details so we can contact you. Orders with
        incorrect information may be delayed or rejected.
      </p>
    </>
  )}
  {orderMode === "delivery" && (
    <textarea
      placeholder="Delivery Address"
      value={deliveryAddress}
      onChange={(e) => setDeliveryAddress(e.target.value)}
      className="w-full border p-3 rounded"
    />
  )}
</div>
          <div className="mt-8 border-t pt-4">
            <p>
              Total Items: {totalItems}
            </p>

            <p className="text-2xl font-bold">
              Total: ₹{subtotal}
            </p>

            <button
              onClick={placeOrder}
              disabled={loading}
              className="mt-4 bg-black text-white px-6 py-3 rounded"
            >
              {loading ? "Placing Order..." : "Place Order"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}