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
    <div className="relative">
      {/* ==========================================================
          Service bar. Only present at a table that has a live
          dine-in session — the two requests below are meaningless
          everywhere else.
          ========================================================== */}
      {dineInSession && (
        <div className="relative mx-auto mb-16 flex max-w-7xl flex-col gap-3 px-6 sm:flex-row lg:px-12">
          <button
            onClick={callWaiter}
            disabled={
              waiterCallStatus === "loading" ||
              waiterCallStatus === "sent"
            }
            className="btn-glass inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[0.8125rem] font-medium tracking-[0.1em] disabled:opacity-60"
          >
            <span className="btn-icon" aria-hidden>
              🔔
            </span>

            <span className="btn-label">
              {waiterCallStatus === "sent"
                ? "Waiter Notified"
                : "Call Waiter"}
            </span>
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
              className="btn-gold inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[0.8125rem] font-semibold tracking-[0.1em] disabled:opacity-60"
            >
              <span className="btn-icon" aria-hidden>
                🧾
              </span>

              <span className="btn-label">
                {billRequested
                  ? "Bill Requested ✅"
                  : billRequestStatus === "loading"
                  ? "Requesting..."
                  : "Request Bill"}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ==========================================================
          Chapters. Each category opens onto its own band of the
          night, alternating the way the leaves of a menu book
          alternate — so no two chapters share a ground.
          ========================================================== */}
      {categories.map((category, index) => (
        <section
          key={category.id}
          className={`grain relative overflow-hidden py-16 sm:py-20 lg:py-24 ${
            index % 2 === 1 ? "veil-maroon" : "veil-emerald"
          }`}
        >
          {/* Hairline at the head of the chapter, fading out at both
              edges so the band never ends on a hard rule. */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(212,175,55,0.22), transparent)",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
            <header className="mb-12 text-center">
              <p
                className="eyebrow mb-5"
                style={{
                  color: "var(--color-gold)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Chapter {romanNumeral(index + 1)}
              </p>

              <h2
                className="text-balance"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--color-ivory)",
                  fontSize: "clamp(1.85rem, 4vw, 3rem)",
                  fontWeight: 400,
                  lineHeight: 1.1,
                  letterSpacing: "0.01em",
                }}
              >
                {category.name}
              </h2>

              <div
                className="ornament mx-auto mt-7 h-px w-28"
                aria-hidden
              />
            </header>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {items
                .filter((item) => item.category_id === category.id)
                .map((item) => (
                  <DishCard
                    key={item.id}
                    item={item}
                    qty={cart[item.id] || 0}
                    onIncrease={() => increase(item.id)}
                    onDecrease={() => decrease(item.id)}
                  />
                ))}
            </div>
          </div>
        </section>
      ))}

      {/* The basket. Pinned to the viewport rather than the document, so
          it is the same height above the fold at the top of the menu and
          at the bottom of it — a customer who has scrolled to the last
          chapter is as far from a cart link as one who has not moved. */}
      <a
        href="/cart"
        aria-label={`View your order${cartCount > 0 ? ` — ${cartCount} item${cartCount === 1 ? "" : "s"}` : ""}`}
        className="btn-gold cart-fab fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-full py-4 pl-5 pr-6 text-[0.8125rem] font-semibold tracking-[0.1em] transition-[padding] duration-400"
      >
        <span className="btn-icon" aria-hidden>
          <svg
            width="17"
            height="17"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path
              d="M4 7.5h12l-1.1 8.2a1.6 1.6 0 0 1-1.6 1.3H6.7a1.6 1.6 0 0 1-1.6-1.3L4 7.5Z"
              strokeLinejoin="round"
            />
            <path d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5" strokeLinecap="round" />
          </svg>
        </span>

        {/* The count is the badge. It sits on the gold face rather than
            floating above it — against a light gradient, an inverted dot
            would read as a smudge at small sizes, and the Request Bill
            button above needs the inverted treatment far more than the
            cart does. */}
        <span className="btn-label hidden sm:inline">View Cart</span>

        {cartCount > 0 && (
          <span
            aria-hidden
            className="cart-fab-count inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[0.75rem] font-semibold tabular-nums"
          >
            {cartCount}
          </span>
        )}
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------
   Roman numerals for the chapter markers. Falls back to the arabic
   figure past the range the numeral set covers, so a long menu never
   shows a row of empty chapter heads.
   ------------------------------------------------------------------ */
const ROMAN = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

function romanNumeral(n: number) {
  return ROMAN[n] ?? String(n);
}

/* ------------------------------------------------------------------
   A dish, as a plate on the page. Presentation only — the quantity
   state and both handlers are handed down from the cart above, which
   remains the single place any of that is decided.
   ------------------------------------------------------------------ */
function DishCard({
  item,
  qty,
  onIncrease,
  onDecrease,
}: {
  item: {
    name: string | null;
    description: string | null;
    image_url: string | null;
    price: number | string;
    is_sold_out: boolean | null;
  };
  qty: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const name = item.name?.trim() || "";
  const description = item.description?.trim();

  return (
    <article className="menu-card group">
      {/* ---- Plate. Fixed 4:5, cropped to cover, never stretched. ----
          A plain <img> rather than next/image: menu image_urls are
          free-form and some point at hosts outside next.config's
          remotePatterns, which next/image rejects at render time. */}
      {item.image_url && (
        <div className="menu-card-media">
          <img
            src={item.image_url}
            alt={name}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h3
            className="text-balance leading-snug"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.375rem",
              fontWeight: 400,
              color: "var(--color-ivory)",
            }}
          >
            {name}
          </h3>

          <span
            className="flex-none"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 400,
              fontSize: "1.0625rem",
              letterSpacing: "0.02em",
              color: "var(--color-gold)",
            }}
          >
            ₹{item.price}
          </span>
        </div>

        {description && (
          <p
            className="text-pretty text-sm leading-[1.7]"
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--color-ivory-muted)",
            }}
          >
            {description}
          </p>
        )}

        {/* The invitation sits at the foot of the plate, so every card
            in a row lands its action on the same line. */}
        <div className="mt-auto pt-6">
          {item.is_sold_out ? (
            <span className="menu-sold-out">Currently Unavailable</span>
          ) : qty > 0 ? (
            <div className="flex items-center justify-between gap-4">
              <span
                className="text-[0.625rem] uppercase tracking-[0.25em]"
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-ivory-faint)",
                }}
              >
                In Your Order
              </span>

              <div className="flex items-center gap-4">
                <button
                  onClick={onDecrease}
                  aria-label={`Remove one ${name}`}
                  className="menu-step"
                >
                  −
                </button>

                <span
                  className="min-w-[1.5rem] text-center"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: "var(--color-ivory)",
                  }}
                >
                  {qty}
                </span>

                <button
                  onClick={onIncrease}
                  aria-label={`Add one more ${name}`}
                  className="menu-step"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onIncrease}
              className="btn-gold inline-flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[0.75rem] font-semibold tracking-[0.14em]"
            >
              <span className="btn-icon" aria-hidden>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                </svg>
              </span>

              <span className="btn-label">Add to Order</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}