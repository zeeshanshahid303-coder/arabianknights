"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DishPhoto } from "../../components/DishPhoto";
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
const [placedOrderDetails, setPlacedOrderDetails] = useState<{ id: string, total: number, tableNumber?: string, status: string } | null>(null);
const [errorMsg, setErrorMsg] = useState<string | null>(null);
/* Seconds left on the seated guest's return to the menu. Null for
   takeaway and delivery, who stay on this page. */
const [returnIn, setReturnIn] = useState<number | null>(null);
/* False until localStorage has been read. The cart is written back on
   every change, so without this the first render — which has not yet
   loaded the saved basket — would write an empty one over the top and
   the guest would arrive to an empty cart. */
const [cartLoaded, setCartLoaded] = useState(false);
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

setCartLoaded(true);
  }, []);

  /* Persist every change to the basket. This is the same write the menu
     makes, kept in step with it, so a quantity adjusted here is the
     quantity the menu shows when the guest goes back. Held back until
     the read above has run, so loading a saved basket is never mistaken
     for a change to it. */
  useEffect(() => {
    if (!cartLoaded) return;

    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart, cartLoaded]);

  /* Counts the seated guest's return to the menu down to the moment it
     happens. Presentation only — the redirect itself is scheduled once,
     in placeOrder; this only keeps the number on screen honest. */
  useEffect(() => {
    if (returnIn == null) return;

    if (returnIn <= 0) return;

    const tick = window.setTimeout(() => {
      setReturnIn((n) => (n == null ? n : n - 1));
    }, 1000);

    return () => window.clearTimeout(tick);
  }, [returnIn]);

  const increase = (id: string) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  /* One step down from the last serving takes the dish off the order
     entirely — the same rule the menu applies, so a dish cannot be left
     in the basket at a quantity of zero. */
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
    setErrorMsg("Please enter name and phone number");
    return;
  }

  if (
    orderMode === "delivery" &&
    !deliveryAddress.trim()
  ) {
    setErrorMsg("Please enter delivery address");
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
    setErrorMsg("Could not verify your table. Please rescan the QR code and try again.");
    return;
  }

  tableId = tableData.id;
  sessionId = await resolveSessionId(tableId, tableData);

  if (!sessionId) {
    setErrorMsg("Could not start your table session. Please try again.");
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
  setErrorMsg("Could not verify prices. Please try again.");
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
  setErrorMsg("Failed to place order. Please try again.");
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

  setErrorMsg("Failed to place order. Please try again.");
  return;
}

  setPlacedOrderDetails({
    id: order.id,
    total: verifiedSubtotal,
    tableNumber: tableNumber || undefined,
    status: orderMode === "dine_in" ? "NEW" : "PENDING_APPROVAL"
  });
  localStorage.removeItem("cart");

setCart({});

setOrderPlaced(true);

if (orderMode === "dine_in") {
  setReturnIn(3);
  setTimeout(() => {
    if (tableNumber && tableToken) {
      window.location.href = `/menu?table=${tableNumber}&token=${tableToken}`;
    } else {
      window.location.href = "/menu";
    }
  }, 3000);
}
    } catch (error) {
      console.error(error);
      setErrorMsg("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grain relative min-h-screen overflow-hidden">
      {/* ==========================================================
          The same night the menu is read in — maroon and emerald in
          the dark air, the lattice behind it, a lamp overhead.
          ========================================================== */}
      <div aria-hidden className="veil-night absolute inset-0" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="mashrabiya-maroon absolute inset-0 h-full w-full opacity-[0.07]"
          style={{
            maskImage:
              "radial-gradient(70% 45% at 50% 8%, #000 0%, rgba(0,0,0,0.35) 60%, transparent 92%)",
            WebkitMaskImage:
              "radial-gradient(70% 45% at 50% 8%, #000 0%, rgba(0,0,0,0.35) 60%, transparent 92%)",
          }}
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
        style={{
          background:
            "radial-gradient(55% 55% at 50% -8%, rgba(232,204,114,0.30) 0%, rgba(212,175,55,0.13) 42%, transparent 80%)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(78% 62% at 50% 34%, transparent 0%, rgba(4,2,6,0.5) 80%, rgba(4,2,6,0.85) 100%)",
        }}
      />

      {/* ==========================================================
          Hero
          ========================================================== */}
      <section className="relative mx-auto max-w-7xl px-6 pb-14 pt-32 text-center sm:pb-16 sm:pt-40 lg:px-12">
        <p
          className="hero-status eyebrow mb-6"
          style={{ color: "var(--color-gold)" }}
        >
          Arabian Knights
        </p>

        <h1
          className="hero-headline mx-auto max-w-4xl text-balance"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "0.01em",
            fontSize: "clamp(2.75rem, 8vw, 5.5rem)",
            color: "var(--color-ivory)",
            textShadow: "0 0 60px rgba(212,175,55,0.15)",
          }}
        >
          Complete Your <span className="text-gold-gradient">Order</span>
        </h1>

        <div
          className="ornament hero-rule mx-auto my-8 h-px w-24"
          aria-hidden
        />

        <p
          className="hero-subtitle mx-auto max-w-xl text-pretty text-[0.9375rem] leading-[1.8] sm:text-[1.0625rem]"
          style={{
            color: "var(--color-ivory)",
            opacity: 0.8,
            fontFamily: "var(--font-sans)",
            fontWeight: 300,
          }}
        >
          Review your selections and provide your details to prepare an
          unforgettable dining experience.
        </p>

        <div className="hero-buttons mt-10">
          <a
            href={
              orderPlaced
                ? "/"
                : orderMode === "dine_in" && tableNumber && tableToken
                ? `/menu?table=${tableNumber}&token=${tableToken}`
                : "/menu"
            }
            className="btn-glass inline-flex items-center justify-center gap-3 rounded-full px-8 py-[0.9rem]"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <span
              aria-hidden
              className="btn-icon"
              style={{ display: "inline-flex" }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M16 10H4M8 6l-4 4 4 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="btn-label">
              {orderPlaced
                ? orderMode === "dine_in"
                  ? "Back to Menu"
                  : "Back to Home"
                : "Back to Menu"}
            </span>
          </a>
        </div>
      </section>

      {/* ==========================================================
          The order itself
          ========================================================== */}
      <section className="relative mx-auto max-w-7xl px-6 pb-32 lg:px-12">
        {orderPlaced ? (
          <div className="mx-auto max-w-2xl text-center">
            <div className="cart-panel cart-panel-pad relative overflow-hidden">
              <div
                className="mashrabiya-gold absolute inset-0 h-full w-full opacity-[0.03] pointer-events-none"
                aria-hidden
                style={{
                  maskImage: "radial-gradient(ellipse at top, #000 0%, transparent 70%)",
                  WebkitMaskImage: "radial-gradient(ellipse at top, #000 0%, transparent 70%)",
                }}
              />
              <div className="relative">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.05)] shadow-[0_0_30px_rgba(212,175,55,0.15)]">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-gold)"
                    strokeWidth="1.5"
                  >
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p
                  className="eyebrow mb-4"
                  style={{ color: "var(--color-gold)", textShadow: "0 0 10px rgba(212,175,55,0.2)" }}
                >
                  Order Confirmed
                </p>
                <h2
                  className="mb-6 text-balance"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2rem, 5vw, 2.75rem)",
                    color: "var(--color-ivory)",
                    lineHeight: 1.1,
                    textShadow: "0 0 60px rgba(212,175,55,0.15)",
                  }}
                >
                  Your Order Has Been <span className="text-gold-gradient">Received</span>
                </h2>
                <p
                  className="mx-auto max-w-md text-pretty text-[0.9375rem] leading-[1.8]"
                  style={{
                    color: "var(--color-ivory)",
                    opacity: 0.8,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Thank you for choosing Arabian Knights. We have reserved your selections and are preparing your {orderMode === "delivery" ? "delivery" : orderMode === "dine_in" ? "order" : "takeaway"} with the utmost care.
                </p>

                {placedOrderDetails && (
                  <div className="mt-10 border-t border-[rgba(212,175,55,0.15)] pt-8 text-left">
                    <h3 className="mb-6 font-medium text-[var(--color-gold)] text-[0.8125rem] tracking-[0.14em] uppercase">Order Details</h3>
                    <div className="grid grid-cols-2 gap-y-6 px-2 sm:grid-cols-3">
                      <div>
                        <div className="mb-1 text-[0.8125rem] text-[var(--color-ivory-faint)]">Order No.</div>
                        <div className="font-mono text-[var(--color-ivory)]">#{placedOrderDetails.id.slice(0, 8)}</div>
                      </div>
                      {placedOrderDetails.tableNumber && (
                        <div>
                          <div className="mb-1 text-[0.8125rem] text-[var(--color-ivory-faint)]">Table</div>
                          <div className="text-[var(--color-ivory)]">{placedOrderDetails.tableNumber}</div>
                        </div>
                      )}
                      <div className="col-span-2 sm:col-span-1">
                        <div className="mb-2 text-[0.8125rem] text-[var(--color-ivory-faint)]">Status</div>
                        <div>
                           <span className="inline-flex items-center gap-2.5 rounded-full border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.08)] px-3.5 py-1.5 text-xs shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                             <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)] shadow-[0_0_5px_var(--color-gold)]" aria-hidden />
                             <span style={{ color: "var(--color-ivory)", fontWeight: 500 }}>
                               {placedOrderDetails.status === 'PENDING_APPROVAL' ? 'Being Prepared' : placedOrderDetails.status === 'NEW' ? 'Sent to Kitchen' : placedOrderDetails.status}
                             </span>
                           </span>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-[0.8125rem] text-[var(--color-ivory-faint)]">Total</div>
                        <div className="text-[var(--color-ivory)] font-medium text-[1.125rem]">₹{placedOrderDetails.total}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* A seated guest is returned to the menu on a short
                    timer, so say so rather than leaving them to wonder
                    whether the page has frozen. */}
                {orderMode === "dine_in" && (
                  <p
                    className="mt-8 text-[0.8125rem] tracking-[0.1em] uppercase"
                    style={{ color: "var(--color-ivory-faint)" }}
                  >
                    Returning to the menu
                    {returnIn != null && (
                      <span className="tabular-nums"> in {returnIn}s</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="mx-auto max-w-2xl text-center">
            <div className="cart-panel cart-panel-pad relative overflow-hidden">
              <div
                className="mashrabiya-gold absolute inset-0 h-full w-full opacity-[0.03] pointer-events-none"
                aria-hidden
                style={{
                  maskImage: "radial-gradient(ellipse at center, #000 0%, transparent 60%)",
                  WebkitMaskImage: "radial-gradient(ellipse at center, #000 0%, transparent 60%)",
                }}
              />
              <div className="relative">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-ivory-faint)"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h2
                  className="mb-4"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
                    color: "var(--color-ivory)",
                    lineHeight: 1.2,
                  }}
                >
                  Your Cart is Empty
                </h2>
                <p
                  className="mx-auto mb-8 max-w-sm text-pretty text-[0.9375rem] leading-[1.8]"
                  style={{
                    color: "var(--color-ivory)",
                    opacity: 0.7,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Return to the menu to explore our culinary offerings and begin preparing your order.
                </p>
                <a
                  href={
                    orderMode === "dine_in" && tableNumber && tableToken
                      ? `/menu?table=${tableNumber}&token=${tableToken}`
                      : "/menu"
                  }
                  className="btn-glass inline-flex items-center justify-center gap-3 rounded-full px-8 py-[0.9rem]"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    aria-hidden
                    className="btn-icon"
                    style={{ display: "inline-flex" }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M16 10H4M8 6l-4 4 4 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="btn-label">
                    Back to Menu
                  </span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-10">
            {/* ---- The dishes ---- */}
            <div className="space-y-4">
              {cartItems.map((item) => {
                const name = item.name?.trim() || "";
                const description = item.description?.trim();
                const photoSrc = item.image_url?.trim() || "";
                const qty = cart[item.id];

                return (
                  <article className="cart-line" key={item.id}>
                    <div className="cart-line-media">
                      <div className="menu-card-plate" role="presentation" />

                      {photoSrc && (
                        <DishPhoto
                          key={photoSrc}
                          src={photoSrc}
                          name={name}
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="cart-line-name">{name}</h2>

                      {description && (
                        <p className="cart-line-note">{description}</p>
                      )}

                      <button
                        type="button"
                        className="cart-remove mt-2"
                        onClick={() => decrease(item.id)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="cart-line-side">
                      <span className="cart-line-unit">
                        ₹{item.price} × {qty}
                      </span>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`Remove one ${name}`}
                          className="menu-step"
                          onClick={() => decrease(item.id)}
                        >
                          −
                        </button>

                        <span
                          aria-label={`Quantity ${qty}`}
                          style={{
                            minWidth: "1.5rem",
                            textAlign: "center",
                            fontFamily: "var(--font-sans)",
                            fontSize: "1rem",
                            fontVariantNumeric: "tabular-nums",
                            color: "var(--color-ivory)",
                          }}
                        >
                          {qty}
                        </span>

                        <button
                          type="button"
                          aria-label={`Add one ${name}`}
                          className="menu-step"
                          onClick={() => increase(item.id)}
                        >
                          +
                        </button>
                      </div>

                      <span className="cart-line-total">
                        ₹{item.price * qty}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* ---- The guest, and the ledger ---- */}
            <div className="space-y-6">
              {orderMode !== "dine_in" && (
                <div className="cart-panel cart-panel-pad">
                  <h2 className="cart-panel-title">Guest Information</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="cart-field-label" htmlFor="cart-name">
                        Customer Name
                      </label>
                      <input
                        id="cart-name"
                        type="text"
                        placeholder="Your full name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="cart-field"
                      />
                    </div>

                    <div>
                      <label className="cart-field-label" htmlFor="cart-phone">
                        Phone Number
                      </label>
                      <input
                        id="cart-phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="How we can reach you"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="cart-field"
                      />
                    </div>

                    {orderMode === "delivery" && (
                      <div>
                        <label
                          className="cart-field-label"
                          htmlFor="cart-address"
                        >
                          Delivery Address
                        </label>
                        <textarea
                          id="cart-address"
                          rows={3}
                          placeholder="Where we should deliver"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="cart-field"
                        />
                      </div>
                    )}

                    <p
                      className="text-[0.8125rem] leading-[1.7]"
                      style={{ color: "var(--color-ivory-faint)" }}
                    >
                      Please enter correct details so we can contact you.
                      Orders with incorrect information may be delayed or
                      rejected.
                    </p>
                  </div>
                </div>
              )}

              <div className="cart-panel cart-panel-pad">
                <h2 className="cart-panel-title">Order Summary</h2>

                <dl className="space-y-3">
                  <div className="cart-summary-row">
                    <dt>Total Items</dt>
                    <dd>{totalItems}</dd>
                  </div>

                  <div className="cart-summary-row">
                    <dt>Subtotal</dt>
                    <dd>₹{subtotal}</dd>
                  </div>
                </dl>

                <div className="rule-gold my-5" aria-hidden />

                <dl className="cart-total">
                  <dt>Grand Total</dt>
                  <dd className="text-gold-gradient">₹{subtotal}</dd>
                </dl>

                {errorMsg && (
                  <div className="mb-6 rounded-lg border border-[#a84444] bg-[#2a0808]/80 p-4 text-center">
                    <p className="text-[0.875rem] text-[#e0a6a6]">{errorMsg}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    placeOrder();
                  }}
                  disabled={loading}
                  className="btn-gold mt-7 w-full rounded-full px-8 py-4"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  <span className="btn-label">
                    {loading ? "Placing Order..." : "Place Order"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* A last full-bleed band, so the page ends in the same dark the
          hero opened with rather than on a cut edge. */}
      <div
        aria-hidden
        className="pointer-events-none relative h-32 w-full"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(4,2,6,0.85) 100%)",
        }}
      >
        <div
          className="mashrabiya-gold absolute inset-0 h-full w-full opacity-[0.06]"
          style={{
            maskImage: "linear-gradient(to top, #000 0%, transparent 70%)",
            WebkitMaskImage:
              "linear-gradient(to top, #000 0%, transparent 70%)",
          }}
        />
      </div>
    </main>
  );
}