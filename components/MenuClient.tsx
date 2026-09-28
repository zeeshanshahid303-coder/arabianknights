"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { supabase, uniqueChannelTopic } from "../lib/supabase";
import { DishPhoto } from "./DishPhoto";

export default function MenuClient({
  items,
  categories,
}: {
  items: any[];
  categories: any[];
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  /* False until localStorage has been read. The basket is written back on
     every change, so without this the first render — which has not yet
     loaded the saved order — writes an empty one over the top and the
     returning guest finds their order gone. */
  const [cartLoaded, setCartLoaded] = useState(false);
const [dineInSession, setDineInSession] = useState<{
  tableNumber: string;
  tableToken: string;
} | null>(null);

const [waiterCallStatus, setWaiterCallStatus] = useState<
  "idle" | "loading" | "sent" | "error"
>("idle");

/* The id of the table_requests row this guest's own call created, kept so
   the button can follow THAT call rather than any call made at this table
   by anyone else — a second diner ringing their own bell must not appear
   to have answered this one's.

   A ref rather than state: the only reader is the realtime handler below,
   which is bound once at subscribe time. State would close over the value
   that was null on the first render and never see the call that comes
   seconds later. Nothing renders it, so it earns no re-render. */
const myWaiterCallIdRef = useRef<string | null>(null);

/* Whether that call has been answered at the table. Read from the row's
   own status field, which the service staff dashboard flips to RESOLVED —
   not from a timer, so the button reopens the moment a human actually
   reaches the table and not before. */
const [waiterReached, setWaiterReached] = useState(false);

const [billRequestStatus, setBillRequestStatus] = useState<
  "idle" | "loading" | "sent" | "error"
>("idle");

/* How far this session's orders have got through the house. Re-derived
   from the same orders the kitchen and the floor are writing to, on every
   realtime change, so the guest is told the truth at the moment it
   becomes true. */
const [orderStatus, setOrderStatus] = useState<
  "idle" | "received" | "preparing" | "ready" | "served"
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

    setCartLoaded(true);
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

/* The four stops a guest is shown, against the order_status enum the
   kitchen and the floor actually write. NEW -> PREPARING -> READY is
   driven by the kitchen; the floor marks an order SERVED when it leaves
   the pass.

   Service staff mark "Served" by writing COMPLETED — that is their
   existing action and it is not changed here. So a dish counts as served
   on either value, which is what lets this read as the four-step thread
   the guest expects without anyone having to adopt a new status. */
const SERVED_STATUSES = ["SERVED", "COMPLETED"];

const ORDER_STAGES = [
  { key: "received", label: "Order Received", match: (s: string) => s === "NEW" },
  { key: "preparing", label: "Being Prepared", match: (s: string) => s === "PREPARING" },
  { key: "ready", label: "Ready", match: (s: string) => s === "READY" },
  { key: "served", label: "Served", match: (s: string) => SERVED_STATUSES.includes(s) },
] as const;

/* How far along the session is, as a single stop.

   The session's orders are ranked rather than counted, because a table
   that has ordered twice should not look finished when the first order
   has been served and the second is still in the pan. A stop is only
   reached once EVERY live order has reached it, so the guest is never
   told a dish is ready while another is still raw. */
function deriveOrderStatus(
  orders: { status: string }[]
): "idle" | "received" | "preparing" | "ready" | "served" {
  const live = (orders ?? []).filter(
    (order) => order.status !== "CANCELLED"
  );

  if (live.length === 0) return "idle";

  const reached = (stage: (typeof ORDER_STAGES)[number]) =>
    live.every((order) => stage.match(order.status));

  for (let i = ORDER_STAGES.length - 1; i >= 0; i -= 1) {
    if (reached(ORDER_STAGES[i])) return ORDER_STAGES[i].key;
  }

  return "received";
}

// Refreshes bill/session state for the table's CURRENT session:
// - billRequested comes straight from table_sessions.bill_requested
// - sessionComplete is true only once every non-cancelled order in this
//   session is COMPLETED (orders table only ever has NEW/COMPLETED)
// - orderStatus is where the session has got to on the service line
const loadSessionState = async () => {
  const tableRow = await getTableRow();

  if (!tableRow?.current_session_id) {
    setBillRequested(false);
    setSessionComplete(false);
    setOrderStatus("idle");
    return;
  }

  const sessionId = tableRow.current_session_id;

  const [{ data: sessionRow }, { data: sessionOrders }] = await Promise.all([
    supabase
      .from("table_sessions")
      .select("bill_requested")
      .eq("id", sessionId)
      .single(),
    supabase
      .from("orders")
      .select("id, status")
      .eq("session_id", sessionId)
      .neq("status", "CANCELLED"),
  ]);

  setBillRequested(Boolean(sessionRow?.bill_requested));
  setOrderStatus(deriveOrderStatus(sessionOrders ?? []));

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
  //
  // table_requests rides the same channel rather than opening a second
  // one: it is the table the guest rang for, and the row that changes is
  // their own. Only the call this guest made is acted on — a bell rung
  // by anyone else at this table leaves this button alone.
  const onRequestChange = (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
    // A DELETE carries its row in `old` and leaves `new` empty, so both
    // halves of the row have to be read from whichever one holds it.
    const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as
      | { id?: string; status?: string }
      | undefined;
    const mine = myWaiterCallIdRef.current;

    // Delivered without a filter, this is every request at every table,
    // so keep only the one this guest is actually waiting on.
    if (mine && row && row.id === mine) {
      setWaiterReached(row.status === "RESOLVED");
    }
  };

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
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "table_requests" },
      onRequestChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [dineInSession]);

  useEffect(() => {
    if (!cartLoaded) return;

    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart, cartLoaded]);

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

  const { data: inserted, error } = await supabase
    .from("table_requests")
    .insert({
      table_id: tableData.id,
      type: "CALL_WAITER",
      status: "PENDING",
    })
    .select("id, status")
    .single();

  if (error) {
    console.error(error);
    setWaiterCallStatus("error");
    return;
  }

  /* The call is now a row in the house, and the button follows that row.
     Previously it waited sixty seconds and then quietly forgot the call
     existed, which meant a guest who rang once and was slow to be served
     was invited to ring again and pile a second bell on the floor. The
     button reopens when staff resolve this request — the UPDATE above
     says RESOLVED — and not one moment sooner. */
  myWaiterCallIdRef.current = inserted?.id ?? null;
  setWaiterReached((inserted?.status ?? "PENDING") === "RESOLVED");
  setWaiterCallStatus("sent");
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
              waiterCallStatus === "error" ||
              waiterReached
            }
            className="btn-glass inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[0.8125rem] font-medium tracking-[0.1em] disabled:opacity-60"
          >
            <span className="btn-icon" aria-hidden style={{ display: "inline-flex" }}>
              {/* A hand-bell rung on a cord — the house's own symbol for
                  service, drawn rather than borrowed from an OS, so the
                  mark sits on the gold face the way the rest of the
                  system's marks do. */}
              <svg
                width="15"
                height="15"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 3.2a4.4 4.4 0 0 1 4.4 4.4c0 2.6.5 3.9 1.2 4.8H4.4c.7-.9 1.2-2.2 1.2-4.8A4.4 4.4 0 0 1 10 3.2Z" />
                <path d="M8.2 14.6a1.9 1.9 0 0 0 3.6 0" />
              </svg>
            </span>

            <span className="btn-label">
              {waiterReached
                ? "Waiter Attended"
                : waiterCallStatus === "sent"
                ? "Waiter Notified"
                : waiterCallStatus === "loading"
                ? "Calling..."
                : waiterCallStatus === "error"
                ? "Couldn't Reach — Tap to Retry"
                : "Call Waiter"}
            </span>
          </button>

          {/* The one moment a diner is actually waiting on, said out loud
              when it happens rather than left to be noticed. */}
          <span aria-live="polite" className="sr-only">
            {waiterReached
              ? "A waiter has reached your table."
              : waiterCallStatus === "sent"
              ? "A waiter has been notified and is on the way."
              : ""}
          </span>

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
              <span className="btn-icon" aria-hidden style={{ display: "inline-flex" }}>
                {/* A bill folded at the top, the way one is handed across
                    a tablecloth — a line mark rather than a pictogram, to
                    sit on the gold face the way the bell beside it does. */}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 2.8h10v14.4l-2.5-1.7-2.5 1.7-2.5-1.7L5 17.2V2.8Z" />
                  <path d="M7.8 7.2h4.4M7.8 10.2h4.4" />
                </svg>
              </span>

              <span className="btn-label">
                {billRequested
                  ? "Bill Requested"
                  : billRequestStatus === "loading"
                  ? "Requesting..."
                  : "Request Bill"}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ==========================================================
          The service line. Shown only once this session has an
          order, and driven entirely by what the kitchen and the
          floor write to orders.status — the guest watches the
          same row the staff are working from.
          ========================================================== */}
      {dineInSession && orderStatus !== "idle" && (
        <div className="relative mx-auto mb-16 max-w-3xl px-6 lg:px-12">
          <div className="cart-panel cart-panel-pad relative overflow-hidden">
            <div
              className="mashrabiya-gold absolute inset-0 h-full w-full opacity-[0.03] pointer-events-none"
              aria-hidden
              style={{
                maskImage:
                  "radial-gradient(ellipse at top, #000 0%, transparent 70%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse at top, #000 0%, transparent 70%)",
              }}
            />

            <div className="relative">
              <p
                className="eyebrow mb-5 text-center"
                style={{ color: "var(--color-gold)" }}
              >
                Your Order
              </p>

              <ol className="service-line">
                {ORDER_STAGES.map((stage, index) => {
                  const at =
                    ORDER_STAGES.findIndex((s) => s.key === orderStatus);

                  const state =
                    index < at ? "done" : index === at ? "active" : "pending";

                  return (
                    <li
                      key={stage.key}
                      className="service-step"
                      data-state={state}
                    >
                      <span className="service-mark" aria-hidden>
                        {state === "done" ? (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M16 10H4M8 6l-4 4 4 4" />
                          </svg>
                        ) : (
                          /* Each stop carries its own mark, so the thread
                             reads as four services rather than four
                             identical dots. */
                          <ServiceMark stage={stage.key} />
                        )}
                      </span>

                      <span className="service-label">{stage.label}</span>
                    </li>
                  );
                })}
              </ol>

              <p className="service-summary mt-7 text-center">
                {orderStatus === "received" &&
                  "Your order is with the kitchen."}
                {orderStatus === "preparing" &&
                  "The kitchen is on it. Your waiter will bring it over."}
                {orderStatus === "ready" &&
                  "Your order is ready and on its way to the table."}
                {orderStatus === "served" &&
                  "Served. Enjoy your meal."}
              </p>
            </div>
          </div>
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
      </div>

      {/* --------------------------------------------------------
          The basket. Portalled to <body> and shown only once there
          is something in it, so it is a true floating action button:
          anchored to the viewport rather than sitting in the page
          flow, unaffected by anything the menu's own containers
          might do to their children's positioning, and out of the
          way of a customer who has not ordered yet.

          Safe to portal without a mounted guard — the cart starts
          empty on the server and is only ever filled from
          localStorage inside an effect, so this branch is
          unreachable during SSR and never mismatches.
          -------------------------------------------------------- */}
      {cartCount > 0 &&
        createPortal(
          <a
            href="/cart"
            aria-label={`View your order — ${cartCount} item${
              cartCount === 1 ? "" : "s"
            }`}
            className="btn-gold cart-fab"
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
                <path
                  d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            <span className="btn-label hidden sm:inline">View Cart</span>

            {/* The count rides on the gold face rather than floating
                above it — against a light gradient an inverted dot
                reads as a smudge at this size, and the Request Bill
                button needs the inverted treatment far more. */}
            <span
              aria-hidden
              className="cart-fab-count inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[0.75rem] font-semibold tabular-nums"
            >
              {cartCount}
            </span>
          </a>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------
   The mark on each stop of the service line. Four line marks rather
   than four identical dots: what is being done, in the same hand as
   the bell and the bill beside it. Drawn in the same 1.4 weight at
   12px so a reached and an unreached stop differ in colour alone.
   ------------------------------------------------------------------ */
function ServiceMark({ stage }: { stage: string }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (stage === "received") {
    // The order, taken down and on the rail.
    return (
      <svg {...common}>
        <path d="M4.5 3.4h8l3 3v10.2h-11V3.4Z" />
        <path d="M12.5 3.4v3h3M7.5 11h5" />
      </svg>
    );
  }

  if (stage === "preparing") {
    // A pan over its flame.
    return (
      <svg {...common}>
        <path d="M3 9.5h11.5a4.75 4.75 0 0 1-4.75 4.75H7.75A4.75 4.75 0 0 1 3 9.5Z" />
        <path d="M14.5 9.5h1.9a1.9 1.9 0 0 1 0 3.8h-.6" />
        <path d="M8 7.2c0-1 .9-1.2.9-2.1M11 7.2c0-1 .9-1.2.9-2.1" />
      </svg>
    );
  }

  if (stage === "ready") {
    // A domed cover, off the dish.
    return (
      <svg {...common}>
        <path d="M3 12.6h14" />
        <path d="M4.4 12.6a5.6 5.6 0 0 1 11.2 0" />
        <path d="M9.2 4.6h1.6" />
      </svg>
    );
  }

  // Served — the dish on its table.
  return (
    <svg {...common}>
      <path d="M10 3.2a4.4 4.4 0 0 1 4.4 4.4c0 2.6.5 3.9 1.2 4.8H4.4c.7-.9 1.2-2.2 1.2-4.8A4.4 4.4 0 0 1 10 3.2Z" />
      <path d="M8.2 14.6a1.9 1.9 0 0 0 3.6 0" />
    </svg>
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

  // Whitespace is not a url, and an empty string is truthy — trim before
  // asking, or `""` sends the frame off to a host for an empty path.
  const photoSrc = item.image_url?.trim() || "";

  return (
    <article className="menu-card group">
      {/* ---- Plate. Always present at a fixed 4:5, cropped to cover,
             never stretched — a dish with no photograph still occupies
             the same rectangle as one with a full set. ----
          A plain <img> rather than next/image: menu image_urls are
          free-form and some point at hosts outside next.config's
          remotePatterns, which next/image rejects at render time. */}
      <div className="menu-card-media">
        <div className="menu-card-plate" role="presentation" />

        {photoSrc && <DishPhoto key={photoSrc} src={photoSrc} name={name} />}
      </div>

      <div className="menu-card-body">
        <div className="menu-card-head">
          <h3 className="menu-card-title">{name}</h3>

          <span className="menu-card-price">₹{item.price}</span>
        </div>

        {/* The note's block is always reserved, described or not — an
            empty but laid-out paragraph is what keeps the price and the
            action on the same line across the whole row. Screen readers
            skip it because it is empty. */}
        <p
          className="menu-card-description"
          style={description ? undefined : { visibility: "hidden" }}
        >
          {description}
        </p>

        {/* The invitation sits at the foot of the plate, so every card
            in a row lands its action on the same line. */}
        <div className="menu-card-actions">
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