"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, uniqueChannelTopic } from "../lib/supabase";

/* Long enough that no honest request is still open at this point, short
   enough that a customer is not left staring at an empty frame. Covers the
   ORB block, which reports neither load nor error, only a dead request. */
const STALLED_IMAGE_MS = 8000;
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
/* ------------------------------------------------------------------
   The photograph, and what stands in its place.

   Three failure modes have to look identical, because from the table
   they are the same event: a dish the kitchen has not photographed, a
   dish whose url is wrong, and a dish whose host is down or blocking
   us. All three end with the house mark in the frame.

   So the plate is a real element that is always mounted and always
   painted; the <img> is a layer on top of it, held at zero opacity
   until the bytes arrive. That ordering is what rules out the
   browser's own broken-image glyph and its alt text — the frame
   always has a face, so the browser is never asked to draw one, and
   the photograph is never visible before it is actually there.

   The three ways a photograph fails to arrive:

     1. no url at all            — never an <img>, the plate alone
     2. the request errors       — onError, fires normally
     3. ORB blocks the response  — an error too, but a *fast* one

   Case 3 is the reason this cannot be a plain onError handler. The <img>
   is server-rendered and lazy, so the browser begins fetching it while
   parsing the HTML — long before React hydrates and before onError could
   possibly be attached. An ORB block resolves in a few milliseconds;
   a plain 404 takes seconds. So the two fastest failures arrive before
   there is a listener to hear them, and the slow ones arrive after. The
   result is images that sit at opacity 0 forever with a dead frame
   still mounted over the plate — the worst of both, since the
   photograph is hidden and the frame is wasted.

   So the settled state is *reconciled* rather than *listened for*: as
   soon as React takes over, we ask the element how it went. `complete`
   means the browser has already finished with this src, and its width
   then says which way it finished. The same pass is repeated for any
   src that changes, and the element is then unmounted on failure rather
   than hidden — an errored <img> is the one element that can still
   paint alt text or the broken glyph, so it must not survive the error.
   ------------------------------------------------------------------ */
type PhotoPhase = "loading" | "ready" | "failed";

function DishPhoto({ src, name }: { src: string; name: string }) {
  const [phase, setPhase] = useState<PhotoPhase>("loading");
  const ref = useRef<HTMLImageElement | null>(null);

  /* The fetch finished — one way or the other. Which one is on the element,
     and the element is the authority: onLoad and onError are the same event
     to us, and neither is trusted to have happened at all. */
  const settle = useCallback(() => {
    const img = ref.current;
    if (img) setPhase(img.naturalWidth > 0 ? "ready" : "failed");
  }, []);

  /* Called on hydration instead of waiting for an event, for a request
     that finished before we were listening. `complete` is the guard that
     makes this safe to call at any time: it is false while a request is
     still in flight, and an in-flight image has no width yet — so asking
     it would read as an empty picture and unmount a photograph that is
     merely still coming. */
  const reconcile = useCallback(() => {
    const img = ref.current;
    if (img && img.complete) settle();
  }, [settle]);

  /* Asked once, on hydration, for a request that finished before we were
     listening. A later change of src remounts this component instead (the
     caller keys it by src), so there is never a second settle to catch and
     no reset to schedule. */
  useEffect(() => {
    reconcile();
  }, [reconcile]);

  /* A card whose src never changes must never be able to strand itself
     on a pending load that will settle into nothing. When this src has
     now been finished for longer than a request could plausibly last,
     the request did not finish at all — a stalled or blocked fetch that
     reports neither load nor error. The element cannot come back from
     this, so it comes out of the tree and the plate takes the frame. */
  useEffect(() => {
    if (phase !== "loading") return;

    const stalled = window.setTimeout(() => {
      const img = ref.current;
      if (img && img.complete) setPhase("failed");
    }, STALLED_IMAGE_MS);

    return () => window.clearTimeout(stalled);
  }, [phase, src]);

  // Dropped from the tree entirely on failure. An <img> that has errored
  // is the one element that can still paint alt text or the broken glyph,
  // so it must not survive the error — not hidden, not transparent.
  if (phase === "failed") return null;

  return (
    <img
      ref={ref}
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      className={phase === "ready" ? "menu-card-photo is-ready" : "menu-card-photo"}
      onLoad={settle}
      onError={settle}
    />
  );
}

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