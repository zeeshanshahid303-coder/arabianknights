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

/* Every order on this table, with its lines and its own place on the
   service line. The shape here is what loadSessionState hands over —
   `lines` is built client-side, because an order can carry the same dish
   more than once and the guest should read one row per dish, not two.
   Deliberately only a session, not the whole table, so the badge on a
   still-pending approval cannot stand in for a real dish — the hero
   timeline below is the session's floor, and the panel is where a single
   round can be inspected in full. */
const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);

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
  { key: "received", label: "Order Received", match: (s: string | null | undefined) => s === "NEW" },
  { key: "preparing", label: "Being Prepared", match: (s: string | null | undefined) => s === "PREPARING" },
  { key: "ready", label: "Ready", match: (s: string | null | undefined) => s === "READY" },
  { key: "served", label: "Served", match: (s: string | null | undefined) => (s !== null && s !== undefined && SERVED_STATUSES.includes(s)) },
] as const;

type StageKey = (typeof ORDER_STAGES)[number]["key"];

/* Which of the four stops one status is at.

   The same table the session-level thread is drawn from, read per order so
   a second round sitting in the pan while the first is already at the
   table still shows where it actually is. Null only for the two statuses
   outside the thread: a cancelled order, and one still waiting on the
   cashier to approve it — neither is a stop the guest has reached, and
   neither is dressed up as one here. */
function stageForStatus(status: string | null | undefined): StageKey | null {
  if (!status) return null;

  return ORDER_STAGES.find((stage) => stage.match(status))?.key ?? null;
}

/* A money figure as the house writes it.

   Postgres numeric and Supabase's JS client both hand numbers back as
   strings, and an unformatted one is where a leading zero goes missing
   ("₹.00" reads as a bug) and trailing zeros trail out of a sum. So the
   figure is parsed, and anything that does not parse is treated as zero
   rather than rendered as NaN — a total is never better shown wrong. */
function toAmount(value: number | string | null | undefined): number {
  const amount = typeof value === "string" ? Number(value) : value;

  return typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
}

function formatAmount(value: number | string | null | undefined): string {
  return toAmount(value).toFixed(2);
}

const currency = (value: number | string | null | undefined) => `₹${formatAmount(value)}`;

/* ------------------------------------------------------------------
   One round of an order, as the active-orders panel reads it. `lines`
   are already grouped — the panel never has to fold the same dish
   together itself.
   ------------------------------------------------------------------ */
type ActiveOrderLine = {
  key: string;
  name: string;
  quantity: number;
  amount: number;
};

type ActiveOrder = {
  id: string;
  label: string;
  stage: StageKey | null;
  stageLabel: string;
  lines: ActiveOrderLine[];
  total: number;
};

/* ------------------------------------------------------------------
   Folds a round's lines into one row per dish. sum()/add() in the cart
   write each add as its own order_items row, so three taps on the same
   dish are three rows pointing at the same menu item — a guest reading
   that as three dishes has been told the wrong thing.
   ------------------------------------------------------------------ */
function groupOrderLines(
  raw: OrderItemRow[] | null | undefined
): ActiveOrderLine[] {
  const byMenuItem = new Map<string, ActiveOrderLine>();

  (raw ?? []).forEach((line, index) => {
    const key = line.menu_item_id || `row-${index}`;
    const existing = byMenuItem.get(key);

    if (existing) {
      existing.quantity += toAmount(line.quantity);
      existing.amount += toAmount(line.total_price);
      return;
    }

    byMenuItem.set(key, {
      key,
      name: line.menu_items?.name?.trim() || "Dish",
      quantity: toAmount(line.quantity),
      amount: toAmount(line.total_price),
    });
  });

  return [...byMenuItem.values()];
}

/* How far along the session is, as a single stop.

   The session's orders are ranked rather than counted, because a table
   that has ordered twice should not look finished when the first order
   has been served and the second is still in the pan. A stop is only
   reached once EVERY live order has reached it, so the guest is never
   told a dish is ready while another is still raw. */
function deriveOrderStatus(
  orders: { status: string | null | undefined }[]
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

// A row as loadSessionState reads it: the order's own money and status,
// with its lines nested under it. `order_items` carries a foreign key to
// `orders`, so this is the one query that can return a whole round
// grouped the way it was placed — no second request, no second source of
// truth that could disagree with the first.
type OrderRow = {
  id: string;
  status: string | null;
  created_at: string | null;
  subtotal: number | string | null;
  gst: number | string | null;
  discount: number | string | null;
  total: number | string | null;
  order_items?: OrderItemRow[] | null;
};

type OrderItemRow = {
  id: string;
  order_id: string | null;
  menu_item_id: string | null;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  menu_items?: { name: string | null } | null;
};

/* The two knobs of orders.total. Read from the order rather than summed
   from its lines, because the cashier's approved discount lands on the
   order (app/cash-counter allocates it per order and rewrites total);
   recomputing the figure here from subtotal alone would quietly bill the
   guest the pre-discount amount. GST is added because it is not folded
   into subtotal at insert — app/cart writes the two separately.

   With a null total on any order, the sum of the others is used instead:
   one order that has not been through pricing yet should hold up the
   figure, not blank the tab. */
function sumSessionTotal(orders: OrderRow[]): number {
  let sum = 0;

  for (const order of orders) {
    const total = order.total === null || order.total === undefined
      ? null
      : toAmount(order.total);

    sum +=
      total === null
        ? Math.max(
            0,
            toAmount(order.subtotal) + toAmount(order.gst) - toAmount(order.discount)
          )
        : total;
  }

  return sum;
}

/* Short rounds get named by the minute they were placed. Two rounds
   inside the same minute, or a clock this app's timezone cannot render,
   would otherwise be called the same thing — so the two claims are never
   both made: the number is used whenever it is needed to tell the rounds
   apart, and the time only when it is not. */
function orderRoundLabel(
  order: OrderRow,
  index: number,
  sameMinute: boolean
): string {
  const placed = order.created_at ? new Date(order.created_at) : null;

  const time = placed && !Number.isNaN(placed.getTime())
    ? placed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  if (time && !sameMinute) return `Order ${index + 1} · ${time}`;

  return `Order ${index + 1}`;
}

/* ------------------------------------------------------------------
   What the guest is shown once the floor takes the table back.

   Captured while the session is still readable, because the moment
   `current_session_id` goes null this client has no session to ask
   about any more: every read here is scoped to the CURRENT one, and
   there is no longer one. So the figures are taken as they stand on
   the last read that still had a session, and latched — the
   completion screen is a receipt of the meal that just happened, not
   a query run afterwards. */
type Farewell = {
  sessionId: string;
  total: number;
  orders: number;
};

/* How long to wait between looks, and how long to keep looking, while
   the floor's close is still in flight. The cash counter ends the
   session and frees the table as two separate writes, the session
   first, so a guest can be told about the first a moment before the
   second has happened. */
const FAREWELL_SETTLE_MS = 400;
const FAREWELL_GIVE_UP_MS = 5000;

/* A pause, awaited. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const [runningTotal, setRunningTotal] = useState(0);

/* The meal, once it is over. Held in state rather than derived,
   because it has to outlive the clearing of everything above it: when
   the session closes, the service bar, the service line and the
   active orders all go, and this is what stands in their place. Null
   until a session that was genuinely open has actually been closed,
   so a table nobody has sat at is never congratulated for anything. */
const [farewell, setFarewell] = useState<Farewell | null>(null);

/* The last session this guest was shown an open table for, and the
   receipt taken from it. A ref because nothing renders it: its only
   job is to answer, synchronously, whether there was a meal to close
   out at all. */
const lastKnownSessionRef = useRef<Farewell | null>(null);

/* Records a session as one this guest dined under, and the figures it
   had at that moment.

   A session already latched is left exactly as it was: an order
   changing must not rewrite the receipt of a meal that has since been
   closed and paid for, so the figures are only taken the first time
   this session is seen. That also bounds the work — the receipt is
   not recomputed on every keystroke of the kitchen. */
const latchSession = (sessionId: string, orders: OrderRow[]) => {
  if (lastKnownSessionRef.current?.sessionId === sessionId) return;

  lastKnownSessionRef.current = {
    sessionId,
    total: sumSessionTotal(orders),
    orders: orders.length,
  };
};

/* The receipt as it actually stood when the floor closed the session.

   The session's orders stay where they are under their session id, so
   they are read one last time rather than the figure being estimated
   from what was last latched. Best-effort by design: if that read
   does not arrive, the latched figures stand — a real total from a
   real read, which is better than a blank, and only ever a little
   short, because a latched figure is itself only written once the
   kitchen's newest change to this session has already been seen. */
const readFinalFarewell = async (latched: Farewell): Promise<Farewell> => {
  const { data } = await supabase
    .from("orders")
    .select("id, subtotal, gst, discount, total")
    .eq("session_id", latched.sessionId)
    .neq("status", "CANCELLED");

  const orders = (data ?? []) as unknown as OrderRow[];

  if (orders.length === 0) return latched;

  return {
    sessionId: latched.sessionId,
    total: sumSessionTotal(orders),
    orders: orders.length,
  };
};

/* Whether the close has actually landed, looked for rather than
   assumed. The two errors are not symmetric: deciding "closed" on a
   single look that is simply early would retire the receipt of a meal
   still being served, so a look is repeated until it says yes or the
   wait runs out. */
const waitForSessionEnd = async (sessionId: string): Promise<boolean> => {
  const deadline = Date.now() + FAREWELL_GIVE_UP_MS;

  for (;;) {
    const { data } = await supabase
      .from("table_sessions")
      .select("status, ended_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (data?.status === "completed" || data?.ended_at) return true;

    if (Date.now() >= deadline) return false;

    await wait(FAREWELL_SETTLE_MS);
  }
};

/* The table has no session on it. Either the meal that was open here
   has just been closed and paid for, or there was never one — and the
   latch is the only thing that tells those two apart, which is what
   keeps a guest who sat down to an empty table from being thanked
   for a meal they never had.

   Both marks of a close are followed rather than one. The session
   being written as completed is the floor's own act and always comes
   first; the table being freed is the other half, and can be the only
   mark a quieter close leaves. So neither decides it alone. */
const handleSessionClosed = async (tableRow: {
  current_session_id: string | null;
} | null) => {
  if (tableRow?.current_session_id) {
    // Closed at the session, not yet freed at the table — the gap
    // between the cashier's two writes. Latching here is what covers
    // a guest whose notification lands in exactly that moment.
    const { data } = await supabase
      .from("orders")
      .select("id, subtotal, gst, discount, total")
      .eq("session_id", tableRow.current_session_id)
      .neq("status", "CANCELLED");

    latchSession(
      tableRow.current_session_id,
      (data ?? []) as unknown as OrderRow[]
    );

    const { data: latestSession } = await supabase
      .from("table_sessions")
      .select("status, ended_at")
      .eq("id", tableRow.current_session_id)
      .maybeSingle();

    if (latestSession?.status === "completed" || latestSession?.ended_at) {
      // The session is closed. Blank the UI and draw the receipt now,
      // without waiting for the table to be freed — the guest should not
      // read the blank gap.
      setBillRequested(false);
      setSessionComplete(false);
      setOrderStatus("idle");
      setActiveOrders([]);
      setRunningTotal(0);

      const closed = await readFinalFarewell(lastKnownSessionRef.current!);
      lastKnownSessionRef.current = null;
      setFarewell(closed);
    }
    return;
  }

  setBillRequested(false);
  setSessionComplete(false);
  setOrderStatus("idle");
  setActiveOrders([]);
  setRunningTotal(0);

  const latched = lastKnownSessionRef.current;

  if (!latched) return;

  const { data: sessionRow } = await supabase
    .from("table_sessions")
    .select("status, ended_at")
    .eq("id", latched.sessionId)
    .maybeSingle();

  if (sessionRow?.status !== "completed" && !sessionRow?.ended_at) {
    // Neither mark has landed. The UI above has already been cleared,
    // which is the existing behaviour and the honest one — the session
    // really is gone from the table. What can still be salvaged is
    // the receipt, and it is worth the wait.
    if (!(await waitForSessionEnd(latched.sessionId))) return;
  }

  const closed = await readFinalFarewell(latched);

  // Cleared as the receipt is taken, so that a fresh dining party
  // seating at this same table latches afresh and is thanked for
  // their own meal rather than shown this one.
  lastKnownSessionRef.current = null;
  setFarewell(closed);
};

// Refreshes bill/session state for the table's CURRENT session:
// - billRequested comes straight from table_sessions.bill_requested
// - sessionComplete is true only once every non-cancelled order in this
//   session is COMPLETED (orders table only ever has NEW/COMPLETED)
// - orderStatus is where the session has got to on the service line
// - activeOrders and runningTotal are that same result read out in full
const loadSessionState = async () => {
  const tableRow = await getTableRow();

  if (!tableRow?.current_session_id) {
    await handleSessionClosed(tableRow);
    return;
  }

  const sessionId = tableRow.current_session_id;

  const [{ data: sessionRow }, { data: sessionOrders }] = await Promise.all([
    supabase
      .from("table_sessions")
      .select("status, bill_requested, ended_at")
      .eq("id", sessionId)
      .single(),
    supabase
      .from("orders")
      .select(`
        id, status, created_at, subtotal, gst, discount, total,
        order_items (
          id, order_id, menu_item_id, quantity, unit_price, total_price,
          menu_items ( name )
        )
      `)
      .eq("session_id", sessionId)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: true }),
  ]);

  /* The row types above exist to give the three derivations below a
     typed argument. supabase-js untyped hands back `any`, and its own
     nested-relation inference types `menu_items` as a one-element ARRAY
     where PostgREST sends an object — the details are asserted on at the
     one place that reads them instead. */
  const orders = (sessionOrders ?? []) as unknown as OrderRow[];

  // This session is open and active, so we are dining under it. Latch it
  // and its figures now so we know, when current_session_id goes null,
  // that there was actually a meal here.
  latchSession(sessionId, orders);

  if (sessionRow?.status === "completed" || sessionRow?.ended_at) {
    await handleSessionClosed(tableRow);
    return;
  }

  setBillRequested(Boolean(sessionRow?.bill_requested));
  setOrderStatus(deriveOrderStatus(orders));

  setSessionComplete(
    Boolean(orders.length) &&
   orders.every(
  (order) => order.status === "COMPLETED"
)
  );

  // What the running tab shows — this session's whole spend, which is
  // the one number a diner wants while the food is still arriving.
  setRunningTotal(sumSessionTotal(orders));

  const minuteOf = (order: OrderRow) =>
    order.created_at ? new Date(order.created_at).getTime() : 0;

  setActiveOrders(
    orders.map((order, index) => {
      const stage = stageForStatus(order.status);
      const sameMinute = orders.some(
        (other, otherIndex) =>
          otherIndex !== index && minuteOf(other) === minuteOf(order)
      );

      return {
        id: order.id,
        label: orderRoundLabel(order, index, sameMinute),
        stage,
        stageLabel:
          stage === null
            ? order.status === "PENDING_APPROVAL"
              ? "Awaiting Approval"
              : "Not In Service"
            : (ORDER_STAGES.find((s) => s.key === stage)?.label ?? ""),
        lines: groupOrderLines(order.order_items),
        total: sumSessionTotal([order]),
      };
    })
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
      {dineInSession && !farewell && (
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

          {/* The running tab. What the table has spent so far, read
              from the same orders the kitchen is working — so it moves
              the moment a round is added, amended or cancelled, without
              the guest having to pull. A figure, not a control: it is
              kept out of the tab order for that reason. */}
          {activeOrders.length > 0 && (
            <div
              className="running-tab ml-auto flex items-center gap-3 self-start sm:self-auto"
              aria-label={`Running total ${currency(runningTotal)}`}
            >
              <span className="running-tab-mark" aria-hidden>
                {/* The house's ledger rule — three lines under a head,
                    the same hand as the marks on the service line. */}
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
                  <path d="M4.5 4.2h11" />
                  <path d="M4.5 8.1h7" />
                  <path d="M4.5 12h9" />
                  <path d="M4.5 15.9h5" />
                </svg>
              </span>

              <span className="running-tab-text">
                <span className="running-tab-label">
                  Running Total
                </span>
                <span className="running-tab-figure tabular-nums">
                  {currency(runningTotal)}
                </span>
              </span>
            </div>
          )}

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
      {dineInSession && orderStatus !== "idle" && !farewell && (
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
          The active orders. Every round this table has placed, newest
          last, each with its own line on the service line above — so a
          table that has ordered twice can see which round is still in
          the pan rather than being told, as a single thread can only
          tell them, that the table as a whole has moved.
          ========================================================== */}
      {dineInSession && activeOrders.length > 0 && !farewell && (
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
                className="eyebrow mb-2 text-center"
                style={{ color: "var(--color-gold)" }}
              >
                Active Orders
              </p>

              <h2
                className="mb-8 text-center"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.5rem",
                  fontWeight: 400,
                  lineHeight: 1.2,
                  letterSpacing: "0.01em",
                  color: "var(--color-ivory)",
                }}
              >
                {activeOrders.length === 1
                  ? "One Round on the Table"
                  : `${activeOrders.length} Rounds on the Table`}
              </h2>

              <ol className="order-stack">
                {activeOrders.map((order) => (
                  <li key={order.id} className="order-round">
                    <div className="order-round-head">
                      <div className="order-round-heading">
                        <p className="order-round-name">{order.label}</p>

                        <p
                          className="order-round-state"
                          data-stage={order.stage ?? "none"}
                        >
                          {order.stageLabel}
                        </p>
                      </div>

                      <p className="order-round-total tabular-nums">
                        {currency(order.total)}
                      </p>
                    </div>

                    {order.lines.length > 0 ? (
                      <ul className="order-lines">
                        {order.lines.map((line) => (
                          <li key={line.key} className="order-line">
                            <span className="order-line-qty tabular-nums">
                              {line.quantity}&times;
                            </span>

                            <span className="order-line-name">
                              {line.name}
                            </span>

                            <span className="order-line-amount tabular-nums">
                              {currency(line.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      /* A round whose lines are still being written. Said
                         rather than left as a blank block, so a guest is
                         never left reading an order that appears empty. */
                      <p className="order-round-empty">
                        Being written to the order.
                      </p>
                    )}

                    {/* The session thread again, at this round's own
                        depth. Same marks, same order, read off this
                        order's status — a compact thread of its own so
                        it does not have to borrow the panel's. */}
                    <ol className="service-line service-line-compact">
                      {ORDER_STAGES.map((stage, index) => {
                        const at = ORDER_STAGES.findIndex(
                          (s) => s.key === order.stage
                        );

                        const state =
                          index < at
                            ? "done"
                            : index === at
                            ? "active"
                            : "pending";

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
                                <ServiceMark stage={stage.key} />
                              )}
                            </span>

                            <span className="service-label">
                              {stage.label}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          Session Completion. The floor has closed and paid the
          table. The active service UI is replaced with a receipt
          of the meal and a clean exit.
          ========================================================== */}
      {farewell && (
        <section className="relative mx-auto mb-16 max-w-3xl px-6 lg:px-12">
          <div className="cart-panel cart-panel-pad relative overflow-hidden text-center">
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
              <div className="mx-auto mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-[rgba(212,175,55,0.3)] bg-[rgba(212,175,55,0.05)] shadow-[0_0_30px_rgba(212,175,55,0.15)]">
                {/* An elegant completion mark: a star in a laurel, drawn
                    in the same stroke weight and hand as the system's
                    other icons. */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-gold)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>

              <p className="eyebrow mb-4 text-gold-gradient">
                Service Complete
              </p>

              <h2
                className="mb-6 text-balance text-gold-gradient"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2rem, 5vw, 2.75rem)",
                  lineHeight: 1.1,
                  textShadow: "0 0 60px rgba(212,175,55,0.15)",
                }}
              >
                Thank You For Dining With Us
              </h2>

              <p
                className="mx-auto max-w-md text-pretty text-[0.9375rem] leading-[1.8] text-white/80"
                style={{
                  fontFamily: "var(--font-sans)",
                }}
              >
                We hope your evening was nothing short of extraordinary. The
                cashier has closed your table and settled the bill.
              </p>

              <div
                className="mx-auto mt-10 max-w-md rounded border border-[rgba(212,175,55,0.2)] bg-[rgba(0,0,0,0.2)] px-6 py-5 text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.625rem] font-medium uppercase tracking-[0.2em] text-[var(--color-ivory-faint)]">
                      Final Total
                    </p>
                    <p className="mt-1 font-sans text-xl font-medium tabular-nums text-[var(--color-gold)]">
                      {currency(farewell.total)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.625rem] font-medium uppercase tracking-[0.2em] text-[var(--color-ivory-faint)]">
                      Orders
                    </p>
                    <p className="mt-1 font-sans text-xl font-medium tabular-nums text-[var(--color-gold)]">
                      {farewell.orders}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                {/* The "Start New Order" exit action. Pointing the same table
                    number at /cart builds a new session and writes it back to
                    the table, making it occupied again, exactly like a new
                    customer's first scan. */}
                <a
                  href={`/cart?mode=dine_in&table=${dineInSession?.tableNumber}&token=${dineInSession?.tableToken}`}
                  className="btn-gold inline-flex w-full items-center justify-center gap-3 rounded-full px-8 py-3.5 sm:w-auto"
                >
                  <span className="btn-icon" aria-hidden>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <path d="M10 6v8M6 10h8" />
                    </svg>
                  </span>
                  <span className="btn-label font-sans text-[0.8125rem] font-semibold tracking-[0.1em] uppercase">
                    Start New Order
                  </span>
                </a>

                {/* The "Return to Menu" exit action. Clears the latched
                    receipt and drops back to the default unoccupied menu. */}
                <button
                  onClick={() => setFarewell(null)}
                  className="btn-glass inline-flex w-full items-center justify-center gap-3 rounded-full px-8 py-3.5 sm:w-auto"
                >
                  <span className="btn-label font-sans text-[0.8125rem] font-medium tracking-[0.1em] uppercase">
                    Return to Menu
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
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