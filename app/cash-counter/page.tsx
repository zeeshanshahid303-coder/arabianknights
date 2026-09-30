"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase, uniqueChannelTopic } from "../../lib/supabase";

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

function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

type PaymentMode = "CASH" | "UPI" | "CARD";

export default function CashCounterPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allOrders, setAllOrders] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
  const [allOrderItems, setAllOrderItems] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
  const [allDiscounts, setAllDiscounts] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
  const [discountTypeInput, setDiscountTypeInput] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [discountValueInput, setDiscountValueInput] = useState<number | "">("");
  const [tables, setTables] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
  const [billRequests, setBillRequests] = useState<any[]> /* eslint-disable-line @typescript-eslint/no-explicit-any */([]);
    const [expandedTableId, setExpandedTableId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [manualBillTarget, setManualBillTarget] = useState<any>(null);

  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);

  const notifiedRequestsRef = useRef(new Set<string>());
  const isFirstRequestLoadRef = useRef(true);

  // Selected bill (opened for review / payment / print)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [marking, setMarking] = useState(false);
  const [markStatus, setMarkStatus] = useState<"idle" | "success" | "error">("idle");

  // Payments recorded this session only — no DB table for this yet.
  const [recentPayments, setRecentPayments] = useState<
  {
    tableDisplay: string;
    grandTotal: number;
    tip: number;
    mode: PaymentMode;
    at: string;
  }[]
>([]);

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
  };

  const loadData = async () => {
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error(ordersError);
      return;
    }

    const { data: sessionsData, error: sessionsError } = await supabase
      .from("table_sessions")
      .select("*");

    if (sessionsError) {
      console.error(sessionsError);
      return;
    }

    const { data: discountsData } = await supabase.from("discounts").select("*");
    setAllDiscounts(discountsData ?? []);

    const { data: orderItemsData, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        *,
        menu_items (
          name
        )
      `);

    if (itemsError) {
      console.error(itemsError);
      return;
    }

    const { data: tablesData, error: tablesError } = await supabase
      .from("tables")
      .select("id, table_number, status, current_session_id");

    if (tablesError) {
      console.error(tablesError);
      return;
    }

    // Still fetched from table_requests — kept purely to drive the
    // "new request" sound/notification below. It is NOT the list source
    // for the Bill Requests panel anymore.
    const { data: requestsData, error: requestsError } = await supabase
      .from("table_requests")
      .select("*")
      .eq("status", "PENDING")
      .eq("type", "REQUEST_BILL")
      .order("created_at", { ascending: true });

    if (requestsError) {
      console.error(requestsError);
      return;
    }

    // Defensive fallbacks: Supabase can type these as nullable even when
    // there's no error (e.g. an empty result set in some edge cases).
    // Without this, a single unexpected null blanks the whole dashboard.
    const orders = ordersData ?? [];
    const sessions = sessionsData ?? [];
    const orderItems = orderItemsData ?? [];
    const tablesRows = tablesData ?? [];
    const requests = requestsData ?? [];

     
    const tableNumberById = new Map(
      tablesRows.map((table) => [table.id, table.table_number])
    );

    // Bill total for a SESSION = sum of order.total across every
    // non-cancelled order tied to that session_id. Session-scoped (not
    // table-scoped) so a new customer at the same table never sees the
    // previous guest's total.
    const billTotalForSession = (sessionId: string) =>
      orders
        .filter(
          (order) => order.session_id === sessionId && order.status !== "CANCELLED"
        )
        .reduce((sum, order) => sum + Number(order.total || 0), 0);

    // Source of truth for "who gets shown" is table_sessions, not
    // table_requests: only ACTIVE sessions that have bill_requested set.
    // This is what prevents a stale/old request from a since-ended
    // session ever reappearing for the next customer at that table —
    // Mark Paid ends the session AND clears bill_requested, and any new
    // session for that table starts with bill_requested = false.
    const mergedRequests = sessions
      .filter((session) => session.status === "active" && session.bill_requested)
      .map((session) => ({
        id: `session-${session.id}`,
        session_id: session.id,
        table_id: session.table_id,
        table_display: formatTableNumber(tableNumberById.get(session.table_id)),
        bill_total: billTotalForSession(session.id),
        created_at: session.bill_requested_at || session.started_at,
      }));

    // Bill-request sound — once per newly-seen pending table_requests row,
    // not on poll refreshes, and not for requests already pending on
    // first page load. (Keyed off table_requests, since that's what a
    // fresh "Request Bill" tap inserts as a notification trigger.)
    if (isFirstRequestLoadRef.current) {
      requests.forEach((request) =>
        notifiedRequestsRef.current.add(request.id)
      );
      isFirstRequestLoadRef.current = false;
    } else {
      const unseenRequests = requests.filter(
        (request) => !notifiedRequestsRef.current.has(request.id)
      );

      if (soundEnabledRef.current && unseenRequests.length > 0) {
        new Audio("/waiter-call.mp3").play();
      }

      unseenRequests.forEach((request) =>
        notifiedRequestsRef.current.add(request.id)
      );
    }

    setAllOrders(orders);
    setAllOrderItems(orderItems);
    setTables(tablesRows);
    setBillRequests(mergedRequests);
  };
useEffect(() => {
  const initialize = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/staff/login";
      return;
    }

    const { data: staff } = await supabase
      .from("staff")
      .select("*")
      .eq("email", session.user.email)
      .eq("status", "approved")
      .single();

    if (!staff) {
      await supabase.auth.signOut();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/staff/login";
      return;
    }

    if (staff.role !== "cashier") {
      await supabase.auth.signOut();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/staff/login";
      return;
    }

    setCheckingAccess(false);
  };

  initialize();
}, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 5000);

    const requestsChannel = supabase
      .channel(uniqueChannelTopic("cash-counter-table-requests"))
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

    const ordersChannel = supabase
      .channel(uniqueChannelTopic("cash-counter-orders"))
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

    const sessionsChannel = supabase
      .channel(uniqueChannelTopic("cash-counter-table-sessions"))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_sessions",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const discountsChannel = supabase.channel(uniqueChannelTopic("cash-counter-discounts")).on("postgres_changes", { event: "*", schema: "public", table: "discounts" }, () => loadData()).subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(discountsChannel);
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tableNumberById = new Map(
    tables.map((table) => [table.id, table.table_number])
  );

 // ---- Daily summary ----
// Only paid orders count toward every metric below — rejected, pending,
// preparing, and completed-but-unpaid orders are excluded from all three,
// per business rule: Sales/Orders/Completed = only orders where paid = true.
const todaysPaidOrders = allOrders.filter(
  (order) => isToday(order.created_at) && order.paid === true
);
const todaysOrders = todaysPaidOrders;
const todaysSales = todaysPaidOrders.reduce(
  (sum, order) => sum + Number(order.total || 0),
  0
);
const todaysCompletedOrders = todaysPaidOrders;
  // ---- Running Tables (occupied tables with an active session) ----
  const pendingApprovals = allOrders.filter(
  (order) =>
    order.order_mode !== "dine_in" &&
    order.status === "PENDING_APPROVAL"
);

  // Shared lookup used by Pending Approvals, Active Orders, and Ready
  // For Billing — same order_items structure already used elsewhere in
  // this file (allOrderItems filtered by order_id, joined to menu_items).
  const itemsForOrder = (orderId: string) =>
    allOrderItems.filter((item) => item.order_id === orderId);

  // Takeaway/Delivery orders the kitchen has accepted and is actively
  // working (or has finished cooking but service hasn't picked up yet).
  // Purely informational here — status transitions stay owned by the
  // Kitchen / Service Staff pages, untouched.
  const activeOrders = allOrders.filter(
    (order) =>
      order.order_mode !== "dine_in" &&
      order.status !== "PENDING_APPROVAL" &&
      order.status !== "COMPLETED" &&
      order.status !== "CANCELLED"
  );

  // Takeaway/Delivery orders the kitchen/service staff have finished
  // (status COMPLETED) that haven't been billed yet (paid !== true).
  // Dine-in orders are excluded — those are billed exclusively through
  // the session-based Bill Requests / Running Tables flow above.
  const readyForBillingOrders = allOrders.filter(
    (order) =>
      order.order_mode !== "dine_in" &&
      order.status === "COMPLETED" &&
      !order.paid
  );

  const runningTables = tables
    .filter((table) => table.status === "OCCUPIED" && table.current_session_id)
    .map((table) => {
      const sessionOrders = allOrders.filter(
        (order) =>
          order.session_id === table.current_session_id &&
          order.status !== "CANCELLED"
      );

      const sessionTotal = sessionOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      );

      return {
        ...table,
        table_display: formatTableNumber(table.table_number),
        sessionOrders,
        orderCount: sessionOrders.length,
        sessionTotal,
      };
    });
  // ---- Selected bill details ----
  const selectedRequest =
    billRequests.find((r) => r.id === selectedRequestId) ||
    (manualBillTarget && manualBillTarget.id === selectedRequestId
      ? manualBillTarget
      : null);
  // Memoized so isBillPaid below has stable dependencies — a fresh array on
  // every render would defeat the memo and re-evaluate the paid check each time.
  const selectedBillOrders = useMemo(
    () =>
      selectedRequest
        ? allOrders
            .filter(
              (order) =>
                selectedRequest.order_id
                  ? order.id === selectedRequest.order_id
                  : order.session_id === selectedRequest.session_id &&
                    order.status !== "CANCELLED"
            )
            .map((order) => ({
              ...order,
              order_items: allOrderItems.filter((item) => item.order_id === order.id),
            }))
        : [],
    [selectedRequest, allOrders, allOrderItems]
  );

  const originalSubtotal = selectedBillOrders.reduce(
    (sum, order) => sum + Number(order.subtotal || 0),
    0
  );

  const activeDiscountRow = selectedRequest
    ? allDiscounts.find(
        (d) =>
          (selectedRequest.order_id && d.order_id === selectedRequest.order_id) ||
          (selectedRequest.session_id && d.session_id === selectedRequest.session_id)
      )
    : null;

  const isDiscountApproved =
    activeDiscountRow &&
    (activeDiscountRow.status === "APPROVED" || activeDiscountRow.status === "AUTO_APPROVED");
  const isDiscountPending = activeDiscountRow?.status === "PENDING";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isDiscountRejected = activeDiscountRow?.status === "REJECTED";
  const currentDiscountAmount = isDiscountApproved ? Number(activeDiscountRow.discount_amount || 0) : 0;

  // Once a bill is settled it is immutable — the discount is baked into the
  // recorded order totals and the payment amount, so removing it afterwards
  // would make the ledger disagree with the bill. This mirrors the guard in
  // the `cashiers_can_remove_unpaid_discounts` RLS policy exactly, so the
  // button disappears at the same moment the database starts refusing the
  // delete. Without it the user only learns the rule by clicking Remove and
  // getting an error, since a denied delete resolves rather than throws.
  const isBillPaid = useMemo(() => {
    if (!selectedRequest) return false;
    return selectedBillOrders.length > 0 && selectedBillOrders.every((o) => o.paid === true);
  }, [selectedRequest, selectedBillOrders]);

  const grandTotal = Math.max(0, originalSubtotal - currentDiscountAmount);

  const finalAmountReceived = grandTotal + (Number(tipAmount) || 0);

  const inputDiscountVal = Number(discountValueInput) || 0;
  const previewDiscountAmount =
    discountTypeInput === "PERCENTAGE"
      ? Number(((originalSubtotal * inputDiscountVal) / 100).toFixed(2))
      : Number(inputDiscountVal.toFixed(2));
  const previewPercentage =
    originalSubtotal > 0 ? (previewDiscountAmount / originalSubtotal) * 100 : 0;

  const openBill = (requestId: string) => {
    setSelectedRequestId(requestId);
    setPaymentMode("CASH");
    setTipAmount(0);
    setMarkStatus("idle");
    setDiscountValueInput("");
  };

  const closeBill = () => {
    setSelectedRequestId(null);
    setManualBillTarget(null);
    setMarkStatus("idle");
  };
    const toggleExpandTable = (tableId: string) => {
    setExpandedTableId((prev) => (prev === tableId ? null : tableId));
  };

  // Opens the existing bill modal for a running table that has not
  // (yet) raised a REQUEST_BILL — reuses the same modal/calculation
  // logic via the selectedRequest fallback above. This is how staff can
  // generate a bill manually even if the customer never tapped Request
  // Bill at the table.
  const openBillForTable = (table: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    const target = {
      id: `table-${table.id}`,
      table_id: table.id,
      table_display: table.table_display,
      session_id: table.current_session_id,
    };

    setManualBillTarget(target);
    setSelectedRequestId(target.id);
    setPaymentMode("CASH");
    setTipAmount(0);
    setMarkStatus("idle");
    setDiscountValueInput("");
  };

  // Opens the same bill modal for a single completed takeaway/delivery
  // order — no table, no session; order_id is the billing key instead.
  const openBillForOrder = (order: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    const target = {
      id: `order-${order.id}`,
      order_id: order.id,
      table_id: null,
      session_id: null,
      table_display: order.order_mode === "delivery" ? "Delivery" : "Takeaway",
      customer_name: order.customer_name,
      phone_number: order.phone_number,
    };

    setManualBillTarget(target);
    setSelectedRequestId(target.id);
    setPaymentMode("CASH");
    setTipAmount(0);
    setMarkStatus("idle");
    setDiscountValueInput("");
  };
const handleApplyDiscount = async () => {
    if (!selectedRequest || discountValueInput === "" || Number(discountValueInput) <= 0) return;

    if (originalSubtotal <= 0) {
      alert("Cannot apply discount on a zero subtotal");
      return;
    }

    const dVal = Number(discountValueInput);
    let computedAmount = 0;

    if (discountTypeInput === "PERCENTAGE") {
      computedAmount = Number(((originalSubtotal * dVal) / 100).toFixed(2));
    } else {
      computedAmount = Number(dVal.toFixed(2));
    }

    if (computedAmount > originalSubtotal) {
      alert("Discount cannot exceed subtotal");
      return;
    }

    // Always calculate effective discount percentage:
    // (discount_amount / original_subtotal) * 100
    const effectivePercentage = (computedAmount / originalSubtotal) * 100;
    const isAutoApproved = effectivePercentage <= 10;
    const setStatus = isAutoApproved ? "AUTO_APPROVED" : "PENDING";

    // Delete any existing discount for this order or session before inserting new one
    if (selectedRequest.order_id) {
      await supabase.from("discounts").delete().eq("order_id", selectedRequest.order_id);
    } else if (selectedRequest.session_id) {
      await supabase.from("discounts").delete().eq("session_id", selectedRequest.session_id);
    }

    const { error } = await supabase.from("discounts").insert({
      order_id: selectedRequest.order_id || null,
      session_id: selectedRequest.session_id || null,
      original_subtotal: originalSubtotal,
      discount_type: discountTypeInput,
      discount_value: dVal,
      discount_amount: computedAmount,
      final_amount: Number((originalSubtotal - computedAmount).toFixed(2)),
      status: setStatus
    });

    if (error) {
      alert("Failed to apply discount");
      console.error(error);
    } else {
      setDiscountValueInput("");
      loadData();
    }
  };

  const removeDiscount = async () => {
    if (!activeDiscountRow) return;

    // Mirrors the RLS guard, so an already-paid bill is refused in the UI
    // instead of silently failing a delete the database will reject.
    if (isBillPaid) {
      alert("This bill has already been paid, so the discount can no longer be removed.");
      return;
    }

    // The delete can be refused by RLS. That resolves as a normal response
    // with `error` set rather than throwing, so it has to be checked
    // explicitly — otherwise the dismissal fails silently, loadData()
    // refetches the same row, and the banner re-renders looking untouched.
    const { error } = await supabase
      .from("discounts")
      .delete()
      .eq("id", activeDiscountRow.id);

    if (error) {
      console.error("Failed to dismiss discount:", error);
      alert("Failed to dismiss discount. Please try again.");
      return;
    }

    setDiscountValueInput("");
    loadData();
  };

  const canTakePaymentOriginal = selectedRequest?.order_id
  ? selectedBillOrders.length > 0 &&
    selectedBillOrders[0]?.status === "COMPLETED"
  : selectedBillOrders.length > 0 &&
    selectedBillOrders.every((order) => order.status === "COMPLETED");
  const canTakePayment = canTakePaymentOriginal && !isDiscountPending;
    const markPaid = async () => {
    if (!selectedRequest) return;

    setMarking(true);
    setMarkStatus("idle");

    // Settlement is a single database call. It marks the orders paid,
    // closes the table session, frees the table, resolves the pending
    // bill request and records the payment — in one transaction, so a
    // failure part-way through can no longer leave money taken against
    // an occupied table, or a closed session with no payment on record.
    //
    // This deliberately no longer writes `table_sessions` (or `tables`)
    // from the browser. Those UPDATEs are gated by
    // `staff_update_sessions` / `staff_update_tables`, which admit only
    // an approved cashier/serving row whose `staff.email` matches the
    // JWT email exactly; anyone else gets an opaque
    // "42501 new row violates row-level security policy" and the bill
    // silently never settles. The function re-checks the same
    // authorisation server-side and is granted to no one else.
    const { data: settlement, error: settleError } = await supabase.rpc(
      "settle_cashier_bill",
      {
        p_order_id: selectedRequest.order_id || null,
        p_session_id: selectedRequest.session_id || null,
        p_tip: Number(tipAmount) || 0,
        p_payment_mode: paymentMode,
      }
    );

    if (settleError) {
      console.error("Failed to settle bill:", settleError);
      setMarkStatus("error");
      setMarking(false);
      return;
    }

    // The amount actually charged comes back from the database rather
    // than being recomputed here, so what the cashier sees is what was
    // written. Falls back to the on-screen figure only if the function
    // returned nothing.
    const settledGrandTotal = Number(
      settlement?.grand_total ?? grandTotal
    );
    const settledTip = Number(settlement?.tip ?? (Number(tipAmount) || 0));

    // Payment mode + tip are also kept in memory for UI display
    setRecentPayments((prev) => [
      {
        tableDisplay: selectedRequest.table_display,
        grandTotal: settledGrandTotal,
        tip: settledTip,
        mode: paymentMode,
        at: new Date().toISOString(),
      },
      ...prev,
    ]);

    setMarkStatus("success");
    setMarking(false);
    loadData();

    setTimeout(() => {
      setSelectedRequestId(null);
      setMarkStatus("idle");
    }, 1200);
  };

  const printBill = () => {
    window.print();
  };
if (checkingAccess) {
  return (
    <main className="cash-page flex items-center justify-center">
      <p className="cash-title">Checking access...</p>
    </main>
  );
}

  return (
    <main className="cash-page">
      <div className="print:hidden">
        <header className="cash-head">
          <div>
            <p className="eyebrow mb-2 text-gold-gradient">Arabian Knights</p>
            <h1 className="cash-title">Cash Counter Dashboard</h1>
          </div>
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
            className="cash-btn cash-btn-outline"
            style={{ width: "auto", alignSelf: "center", minWidth: "12rem" }}
          >
            {soundEnabled ? "🔔 Notifications ON" : "🔕 Notifications OFF"}
          </button>
        </header>

        {/* DAILY SUMMARY */}
        <section className="cash-section">
          <div className="cash-summary-grid mb-8">
            <div className="cash-summary-card">
              <p className="cash-summary-label">Today&apos;s Orders</p>
              <p className="cash-summary-value">{todaysOrders.length}</p>
            </div>
            <div className="cash-summary-card">
              <p className="cash-summary-label">Today&apos;s Sales</p>
              <p className="cash-summary-value">₹{todaysSales}</p>
            </div>
            <div className="cash-summary-card">
              <p className="cash-summary-label">Pending Requests</p>
              <p className="cash-summary-value">{billRequests.length}</p>
            </div>
            <div className="cash-summary-card">
              <p className="cash-summary-label">Completed</p>
              <p className="cash-summary-value">{todaysCompletedOrders.length}</p>
            </div>
          </div>
        </section>

        {pendingApprovals.length > 0 && (
        <section className="cash-section">
          <div className="cash-section-head">
            <h2 className="cash-section-title">Pending Approvals</h2>
            <span className="cash-count">{pendingApprovals.length}</span>
          </div>

          <div className="cash-grid mb-8">
            {pendingApprovals.map((order) => (
              <article key={order.id} className="cash-card">
                <header className="cash-card-head">
                  <p className="cash-card-table">
                    {order.customer_name || "Customer"}
                  </p>
                  <span className="cash-badge cash-badge-active">Approval Req.</span>
                </header>
                <div className="cash-card-body">
                  <div className="mb-4">
                    {order.phone_number && <p className="text-sm text-[var(--color-ivory-muted)]">{order.phone_number}</p>}
                    <p className="text-sm text-[var(--color-ivory-muted)] capitalize">{order.order_mode.replace("_", " ")}</p>
                    {order.order_mode === "delivery" && order.delivery_address && (
                      <p className="text-sm text-[var(--color-ivory-muted)] mt-1">
                        📍 {order.delivery_address}
                      </p>
                    )}
                  </div>

                  {itemsForOrder(order.id).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[var(--color-ivory-muted)] uppercase tracking-wider mb-2">Items</p>
                      <ul className="text-sm text-[var(--color-ivory)] space-y-1">
                        {itemsForOrder(order.id).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, index: number) => (
                          <li key={index}>
                            <span className="font-bold text-[var(--color-ivory)] mr-1">{item.quantity}×</span> {item.menu_items?.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-[var(--color-hairline)]">
                    <p className="cash-total-lg mb-4">₹{order.total}</p>

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await supabase
                            .from("orders")
                            .update({ status: "NEW" })
                            .eq("id", order.id)
                            .eq("status", "PENDING_APPROVAL");

                          loadData();
                        }}
                        className="cash-btn cash-btn-success flex-1"
                      >
                        Accept
                      </button>

                      <button
                        onClick={async () => {
                          await supabase
                            .from("orders")
                            .update({ status: "CANCELLED" })
                            .eq("id", order.id)
                            .eq("status", "PENDING_APPROVAL");

                          loadData();
                        }}
                        className="cash-btn cash-btn-danger flex-1"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        )}

        {/* ACTIVE ORDERS */}
        <section className="cash-section">
          <div className="cash-section-head">
            <h2 className="cash-section-title">Active Orders (Takeaway / Delivery)</h2>
            <span className="cash-count">{activeOrders.length}</span>
          </div>

          <div className="cash-grid mb-8">
            {activeOrders.map((order) => (
              <article key={order.id} className="cash-card">
                <header className="cash-card-head">
                  <p className="cash-card-table">{order.customer_name || "Customer"}</p>
                  <span className="cash-badge cash-badge-active">{order.status}</span>
                </header>

                <div className="cash-card-body">
                  <div className="mb-4">
                    {order.phone_number && <p className="text-sm text-[var(--color-ivory-muted)]">{order.phone_number}</p>}
                    <p className="text-sm text-[var(--color-ivory-muted)] capitalize">{order.order_mode.replace("_", " ")}</p>

                    {order.order_mode === "delivery" && order.delivery_address && (
                      <p className="text-sm text-[var(--color-ivory-muted)] mt-1">
                        📍 {order.delivery_address}
                      </p>
                    )}
                  </div>

                  {itemsForOrder(order.id).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[var(--color-ivory-muted)] uppercase tracking-wider mb-2">Items</p>
                      <ul className="text-sm text-[var(--color-ivory)] space-y-1">
                        {itemsForOrder(order.id).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, index: number) => (
                          <li key={index}>
                            <span className="font-bold text-[var(--color-ivory)] mr-1">{item.quantity}×</span> {item.menu_items?.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-[var(--color-hairline)]">
                    <p className="cash-total-lg">₹{order.total}</p>
                  </div>
                </div>
              </article>
            ))}

            {activeOrders.length === 0 && (
              <p className="text-[var(--color-ivory-faint)] text-sm tracking-wide col-span-full">
                No active takeaway/delivery orders.
              </p>
            )}
          </div>
        </section>

        {/* RUNNING TABLES */}
        <section className="cash-section">
          <div className="cash-section-head">
            <h2 className="cash-section-title">Running Tables</h2>
            <span className="cash-count">{runningTables.length}</span>
          </div>

          <div className="cash-grid mb-8">
            {runningTables.map((table) => (
              <article key={table.id} className="cash-card">
                <header className="cash-card-head">
                  <p className="cash-card-table">Table {table.table_display}</p>
                  <span className="cash-badge cash-badge-active">Occupied</span>
                </header>
                <div className="cash-card-body">
                  <p className="text-sm text-[var(--color-ivory-muted)] mb-4">
                    {table.orderCount} order{table.orderCount === 1 ? "" : "s"}
                  </p>

                  {expandedTableId === table.id && (
                    <div className="mb-4 space-y-3">
                      {table.sessionOrders.map((order: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
                        <div key={order.id}>
                          <p className="text-xs text-[var(--color-gold)] mb-1 uppercase tracking-wider">
                            Order #{String(order.id).slice(0, 8)} — {order.status}
                          </p>

                          <ul className="text-sm text-[var(--color-ivory)] space-y-1">
                            {allOrderItems
                              .filter((item) => item.order_id === order.id)
                              .map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, index: number) => (
                                <li key={index} className="flex justify-between">
                                  <span><span className="font-bold text-[var(--color-ivory)] mr-1">{item.quantity}×</span> {item.menu_items?.name}</span>
                                  <span>₹{item.total_price}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ))}

                      {table.sessionOrders.length === 0 && (
                        <p className="text-sm text-[var(--color-ivory-muted)]">No orders in this session.</p>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-[var(--color-hairline)] flex flex-col gap-4">
                    <p className="cash-total-lg">₹{table.sessionTotal}</p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleExpandTable(table.id)}
                        className="cash-btn cash-btn-secondary flex-1"
                        style={{ padding: "0.5rem" }}
                      >
                        {expandedTableId === table.id ? "Hide Orders" : "Expand"}
                      </button>

                      <button
                        onClick={() => openBillForTable(table)}
                        className="cash-btn cash-btn-primary flex-1"
                        style={{ padding: "0.5rem" }}
                      >
                        Bill
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {runningTables.length === 0 && (
              <p className="text-[var(--color-ivory-faint)] text-sm tracking-wide col-span-full">No tables currently occupied.</p>
            )}
          </div>
        </section>

        {/* BILL REQUESTS */}
        <section className="cash-section">
          <div className="cash-section-head">
            <h2 className="cash-section-title">Bill Requests</h2>
            <span className="cash-count">{billRequests.length}</span>
          </div>

          <div className="cash-grid mb-8">
            {billRequests.map((request) => (
              <article
                key={request.id}
                className="cash-card"
                style={{ borderColor: "rgba(212,175,55,0.4)" }}
              >
                <header className="cash-card-head" style={{ background: "rgba(212,175,55,0.05)" }}>
                  <p className="cash-card-table">Table {request.table_display}</p>
                  <span className="cash-badge cash-badge-bill">Requested</span>
                </header>

                <div className="cash-card-body flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm text-[var(--color-ivory-muted)] mb-6">
                    Requested {new Date(request.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>

                  <button
                    onClick={() => openBill(request.id)}
                    className="cash-btn cash-btn-primary w-full"
                  >
                    View Bill
                  </button>
                </div>
              </article>
            ))}

            {billRequests.length === 0 && (
              <p className="text-[var(--color-ivory-faint)] text-sm tracking-wide col-span-full">No pending bill requests.</p>
            )}
          </div>
        </section>

        {/* READY FOR BILLING */}
        <section className="cash-section">
          <div className="cash-section-head">
            <h2 className="cash-section-title">Ready For Billing</h2>
            <span className="cash-count">{readyForBillingOrders.length}</span>
          </div>

          <div className="cash-grid mb-8">
            {readyForBillingOrders.map((order) => (
              <article key={order.id} className="cash-card">
                <header className="cash-card-head">
                  <p className="cash-card-table">{order.customer_name || "Customer"}</p>
                  <span className="cash-badge cash-badge-bill">Ready</span>
                </header>
                <div className="cash-card-body">
                  <div className="mb-4">
                    {order.phone_number && <p className="text-sm text-[var(--color-ivory-muted)]">{order.phone_number}</p>}
                    <p className="text-sm text-[var(--color-ivory-muted)] capitalize">{order.order_mode.replace("_", " ")}</p>

                    {order.order_mode === "delivery" && order.delivery_address && (
                      <p className="text-sm text-[var(--color-ivory-muted)] mt-1">
                        📍 {order.delivery_address}
                      </p>
                    )}
                  </div>

                  {itemsForOrder(order.id).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[var(--color-ivory-muted)] uppercase tracking-wider mb-2">Items</p>
                      <ul className="text-sm text-[var(--color-ivory)] space-y-1">
                        {itemsForOrder(order.id).map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, index: number) => (
                          <li key={index}>
                            <span className="font-bold text-[var(--color-ivory)] mr-1">{item.quantity}×</span> {item.menu_items?.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-[var(--color-hairline)] flex flex-col gap-4">
                    <p className="cash-total-lg">₹{order.total}</p>

                    <button
                      onClick={() => openBillForOrder(order)}
                      className="cash-btn cash-btn-primary w-full"
                    >
                      Generate Bill
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {readyForBillingOrders.length === 0 && (
              <p className="text-[var(--color-ivory-faint)] text-sm tracking-wide col-span-full">
                No completed takeaway/delivery orders awaiting billing.
              </p>
            )}
          </div>
        </section>

        {/* RECENT PAYMENTS */}
        {recentPayments.length > 0 && (
          <section className="cash-section">
            <div className="cash-section-head">
              <h2 className="cash-section-title">Recent Payments (This Session)</h2>
              <span className="cash-count">{recentPayments.length}</span>
            </div>

            <div className="bg-transparent border border-[var(--color-hairline)] rounded-xl overflow-hidden">
              {recentPayments.map((payment) => (
                <div key={payment.at} className="flex justify-between items-center p-4 border-b border-[var(--color-hairline)] last:border-b-0">
                  <div>
                    <p className="font-semibold text-[var(--color-ivory)]">
                      {payment.tableDisplay === "Takeaway" || payment.tableDisplay === "Delivery"
                        ? payment.tableDisplay
                        : `Table ${payment.tableDisplay}`}
                    </p>
                    <p className="text-sm text-[var(--color-ivory-muted)]">
                      {new Date(payment.at).toLocaleTimeString()} · {payment.mode}
                    </p>
                  </div>
                  <p className="font-display text-lg text-[var(--color-gold)]">
                    ₹{payment.grandTotal + payment.tip}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      {/* BILL DETAILS / PAYMENT / PRINT */}
      {selectedRequest && (
        <div className="cash-modal-overlay print:static print:p-0 print:bg-white print:block">
          <div className="cash-modal print:shadow-none print:border-none print:rounded-none print:max-w-none">
            <div id="printable-invoice" className="cash-modal-body print:p-0">
              <div className="flex items-start justify-between mb-6 print:hidden">
                <h2 className="cash-modal-title">Bill Details</h2>
                <button
                  onClick={closeBill}
                  className="text-[var(--color-ivory-muted)] hover:text-[var(--color-ivory)] border border-[var(--color-hairline)] rounded px-3 py-1 text-sm font-medium transition"
                >
                  Close
                </button>
              </div>

              {/* Invoice header */}
              <div className="border-b border-[var(--color-hairline)] pb-4 mb-4 print:border-b print:border-gray-300">
                <h3 className="font-display text-2xl text-[var(--color-gold)] mb-1 print:text-gray-900 print:text-2xl print:font-bold">Arabian Knights</h3>
                {selectedRequest.order_id ? (
                  <>
                    <p className="text-[var(--color-ivory)] print:text-gray-700">
                      {selectedRequest.table_display}:{" "}
                      <strong>{selectedRequest.customer_name || "—"}</strong>
                    </p>
                    {selectedRequest.phone_number && (
                      <p className="text-sm text-[var(--color-ivory-muted)] print:text-gray-500">
                        {selectedRequest.phone_number}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[var(--color-ivory)] print:text-gray-700">
                    Table: <strong>{selectedRequest.table_display}</strong>
                  </p>
                )}
                <p className="text-sm text-[var(--color-ivory-muted)] print:text-gray-500">
                  {new Date().toLocaleString()}
                </p>
              </div>

              {/* Orders + items */}
              <div className="space-y-4 mb-6">
                {selectedBillOrders.map((order) => (
                  <div key={order.id} className="border-b border-[var(--color-hairline)] pb-4 print:border-gray-200">
                    <p className="text-xs font-bold text-[var(--color-ivory-muted)] uppercase tracking-wider mb-3 print:text-gray-500">
                      Order #{String(order.id).slice(0, 8)} — {order.status}
                    </p>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--color-ivory-muted)] print:text-gray-600">
                          <th className="pb-2 font-medium uppercase tracking-wider text-xs">Item</th>
                          <th className="pb-2 font-medium uppercase tracking-wider text-xs text-center">Qty</th>
                          <th className="pb-2 font-medium uppercase tracking-wider text-xs text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.order_items.map((item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */, index: number) => (
                          <tr key={index} className="text-[var(--color-ivory)] print:text-black">
                            <td className="py-2">{item.menu_items?.name}</td>
                            <td className="py-2 text-center">{item.quantity}</td>
                            <td className="py-2 text-right font-medium">₹{item.total_price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {selectedBillOrders.length === 0 && (
                  <p className="text-sm text-[var(--color-ivory-muted)] print:text-gray-500">No orders found for this table.</p>
                )}
              </div>

              {/* SUBTOTAL, DISCOUNT SYSTEM UI & GRAND TOTAL */}
              <div className="text-[var(--color-ivory)] print:text-black">
                {/* Subtotal */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-[var(--color-ivory-muted)] uppercase tracking-wider font-semibold print:text-gray-600">Subtotal</p>
                  <p className="font-display text-xl text-[var(--color-gold)] print:text-black">₹{originalSubtotal}</p>
                </div>

                {/* DISCOUNT SYSTEM CONTROLS & STATUS (ABOVE GRAND TOTAL) */}
                <div className="print:hidden my-6">
                  {!activeDiscountRow ? (
                    <div className="bg-[rgba(255,255,255,0.02)] border border-[var(--color-hairline)] p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-[var(--color-ivory-muted)] uppercase tracking-wide">Apply Discount</p>
                        {discountValueInput !== "" && Number(discountValueInput) > 0 && originalSubtotal > 0 && (
                          <span className="text-xs text-[var(--color-ivory-muted)]">
                            Calc: <strong className="text-[var(--color-ivory)]">₹{previewDiscountAmount}</strong> ({previewPercentage.toFixed(1)}%)
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 items-center">
                        <select
                          value={discountTypeInput}
                          onChange={(e) => setDiscountTypeInput(e.target.value as "FIXED" | "PERCENTAGE")}
                          className="cash-control"
                          style={{ width: "35%" }}
                        >
                          <option value="FIXED">Flat (₹)</option>
                          <option value="PERCENTAGE">Percent (%)</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={discountValueInput}
                          onChange={(e) => setDiscountValueInput(e.target.value ? Number(e.target.value) : "")}
                          placeholder={discountTypeInput === "PERCENTAGE" ? "e.g. 10" : `Max ₹${originalSubtotal}`}
                          className="cash-control"
                          style={{ flex: 1 }}
                        />
                        <button
                          onClick={handleApplyDiscount}
                          disabled={discountValueInput === "" || Number(discountValueInput) <= 0 || originalSubtotal <= 0}
                          className="cash-btn cash-btn-secondary"
                        >
                          Apply
                        </button>
                      </div>

                      {discountValueInput !== "" && Number(discountValueInput) > 0 && originalSubtotal > 0 && (
                        <div className="mt-3 text-xs">
                          {previewDiscountAmount > originalSubtotal ? (
                            <p className="text-[#f87171] font-medium">⚠️ Max discount is ₹{originalSubtotal}</p>
                          ) : previewPercentage <= 10 ? (
                            <p className="text-[#4ade80] font-medium">⚡ Instant Auto-Approval</p>
                          ) : (
                            <p className="text-[#fbbf24] font-medium">⏳ Requires Owner Approval</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : activeDiscountRow.status === "PENDING" ? (
                    <div className="bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.3)] p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-[rgba(251,191,36,0.15)] text-[#fbbf24] border border-[rgba(251,191,36,0.3)] text-xs font-bold px-2 py-0.5 rounded">
                              ⏳ PENDING APPROVAL
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[var(--color-ivory)]">
                            {activeDiscountRow.discount_type === "PERCENTAGE"
                              ? `${activeDiscountRow.discount_value}% Discount`
                              : `₹${activeDiscountRow.discount_value} Flat Discount`}
                            {" — "}
                            <span className="text-[#fbbf24]">₹{activeDiscountRow.discount_amount} off</span>
                          </p>
                          <p className="text-xs text-[var(--color-ivory-muted)] mt-1">
                            Payment is locked until the owner approves.
                          </p>
                        </div>
                        {!isBillPaid && (
                          <button
                            onClick={removeDiscount}
                            className="text-xs text-[#fbbf24] hover:text-[#fcd34d] font-medium border border-[rgba(251,191,36,0.3)] bg-transparent hover:bg-[rgba(251,191,36,0.1)] px-3 py-1.5 rounded transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ) : activeDiscountRow.status === "APPROVED" || activeDiscountRow.status === "AUTO_APPROVED" ? (
                    <div className="bg-[rgba(34,197,94,0.05)] border border-[rgba(34,197,94,0.3)] p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-[rgba(34,197,94,0.15)] text-[#4ade80] border border-[rgba(34,197,94,0.3)] text-xs font-bold px-2 py-0.5 rounded">
                              {activeDiscountRow.status === "AUTO_APPROVED" ? "⚡ AUTO-APPROVED" : "✅ APPROVED"}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[var(--color-ivory)]">
                            {activeDiscountRow.discount_type === "PERCENTAGE"
                              ? `${activeDiscountRow.discount_value}% Discount`
                              : `₹${activeDiscountRow.discount_value} Flat Discount`}
                            {" — "}
                            <span className="text-[#4ade80]">-₹{activeDiscountRow.discount_amount}</span>
                          </p>
                        </div>
                        {!isBillPaid && (
                          <button
                            onClick={removeDiscount}
                            className="text-xs text-[#f87171] hover:text-[#fca5a5] font-medium border border-[rgba(220,38,38,0.3)] bg-transparent hover:bg-[rgba(220,38,38,0.1)] px-3 py-1.5 rounded transition"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ) : activeDiscountRow.status === "REJECTED" ? (
                    <div className="bg-[rgba(220,38,38,0.05)] border border-[rgba(220,38,38,0.3)] p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-[rgba(220,38,38,0.15)] text-[#f87171] border border-[rgba(220,38,38,0.3)] text-xs font-bold px-2 py-0.5 rounded">
                              ❌ REJECTED
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-ivory)]">
                            Discount of{" "}
                            {activeDiscountRow.discount_type === "PERCENTAGE"
                              ? `${activeDiscountRow.discount_value}%`
                              : `₹${activeDiscountRow.discount_value}`}{" "}
                            (₹{activeDiscountRow.discount_amount}) was declined.
                          </p>
                        </div>
                        {!isBillPaid && (
                          <button
                            onClick={removeDiscount}
                            className="text-xs bg-[rgba(220,38,38,0.15)] hover:bg-[rgba(220,38,38,0.25)] text-[#f87171] font-medium px-3 py-1.5 rounded border border-[rgba(220,38,38,0.3)] transition"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Invoice discount line (print & summary) */}
                {activeDiscountRow && (activeDiscountRow.status === "APPROVED" || activeDiscountRow.status === "AUTO_APPROVED") ? (
                  <div className="flex items-center justify-between text-[#4ade80] py-2 print:text-green-700">
                    <p className="text-sm font-medium">
                      Discount ({activeDiscountRow.discount_type === "PERCENTAGE" ? `${activeDiscountRow.discount_value}%` : `₹${activeDiscountRow.discount_value}`})
                    </p>
                    <p className="text-sm font-bold">-₹{activeDiscountRow.discount_amount}</p>
                  </div>
                ) : activeDiscountRow && activeDiscountRow.status === "PENDING" ? (
                  <div className="flex items-center justify-between text-[#fbbf24] py-2 print:hidden">
                    <p className="text-sm font-medium">
                      Discount ({activeDiscountRow.discount_type === "PERCENTAGE" ? `${activeDiscountRow.discount_value}%` : `₹${activeDiscountRow.discount_value}`})
                    </p>
                    <p className="text-xs font-semibold">Pending Approval (₹{activeDiscountRow.discount_amount})</p>
                  </div>
                ) : null}

                {/* Grand Total */}
                <div className="flex items-center justify-between border-t border-[var(--color-hairline)] mt-4 pt-4 print:border-black">
                  <p className="text-sm text-[var(--color-ivory-muted)] uppercase tracking-wider font-semibold print:text-black">Grand Total</p>
                  <p className="font-display text-3xl text-[var(--color-gold)] font-medium print:text-black">₹{grandTotal}</p>
                </div>
              </div>

              {/* PAYMENT SECTION */}
              <div className="print:hidden mt-8 pt-6 border-t border-[var(--color-hairline)]">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="cash-label">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="cash-control"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>

                  <div>
                    <label className="cash-label">Tip Amount</label>
                    <input
                      type="number"
                      min={0}
                      value={tipAmount}
                      onChange={(e) => setTipAmount(Number(e.target.value))}
                      className="cash-control"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-[var(--color-ivory-muted)] uppercase tracking-wider font-semibold">Final Amount Received</p>
                  <p className="font-display text-2xl text-[var(--color-gold)]">₹{finalAmountReceived}</p>
                </div>
              </div>

              {/* Print-only payment summary */}
              <div className="hidden print:block border-t pt-3 mt-3 text-sm">
                <p>Payment Mode: {paymentMode}</p>
                <p>Tip: ₹{tipAmount}</p>
                <p className="font-bold">Final Amount: ₹{finalAmountReceived}</p>
              </div>
            </div>

            <div className="cash-modal-foot print:hidden">
              <div className="cash-modal-actions">
                <button
                  onClick={printBill}
                  className="cash-btn cash-btn-secondary flex-1"
                >
                  <span className="mr-2 opacity-70">🖨</span> Print Bill
                </button>

                <button
                  onClick={markPaid}
                  disabled={marking || markStatus === "success" || !canTakePayment}
                  className="cash-btn cash-btn-primary flex-1 disabled:opacity-50"
                >
                  {markStatus === "success" ? "✅ Paid" : marking ? "Processing..." : "Mark Paid"}
                </button>
              </div>

              {!canTakePayment && isDiscountPending && (
                <p className="text-[#fbbf24] text-xs text-center font-medium mt-1">
                  ⏳ Payment locked: Discount approval is pending owner review.
                </p>
              )}
              {!canTakePayment && !isDiscountPending && selectedBillOrders.length > 0 && (
                <p className="text-[#f87171] text-xs text-center font-medium mt-1">
                  ⚠ Food must be served before payment.
                </p>
              )}

              {markStatus === "error" && (
                <p className="text-[#f87171] text-xs text-center font-medium mt-1">
                  ⚠️ Something went wrong. Please try again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}