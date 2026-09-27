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
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allOrderItems, setAllOrderItems] = useState<any[]>([]);
  const [allDiscounts, setAllDiscounts] = useState<any[]>([]);
  const [discountTypeInput, setDiscountTypeInput] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [discountValueInput, setDiscountValueInput] = useState<number | "">("");
  const [tables, setTables] = useState<any[]>([]);
  const [billRequests, setBillRequests] = useState<any[]>([]);
    const [expandedTableId, setExpandedTableId] = useState<string | null>(null);
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
      window.location.href = "/staff/login";
      return;
    }

    if (staff.role !== "cashier") {
      await supabase.auth.signOut();
      window.location.href = "/staff/login";
      return;
    }

    setCheckingAccess(false);
  };

  initialize();
}, []);
  useEffect(() => {
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
  const openBillForTable = (table: any) => {
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
  const openBillForOrder = (order: any) => {
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

    // Resolve any pending table_requests tied to this session (e.g. the
    // REQUEST_BILL notification row). Kept non-blocking by design, but the
    // error is now captured and logged instead of being silently discarded
    // — a failure here is exactly what leaves a stale PENDING row behind
    // and causes the next customer's Request Bill tap to hit the
    // unique-constraint error.
    if (selectedRequest.session_id) {
      const { error: requestResolveError } = await supabase
        .from("table_requests")
        .update({
          status: "RESOLVED",
          resolved_at: new Date().toISOString(),
        })
        .eq("session_id", selectedRequest.session_id)
        .eq("status", "PENDING");

      if (requestResolveError) {
        console.error(
          "Failed to resolve table_requests for session",
          selectedRequest.session_id,
          requestResolveError
        );
      }
    }

    const approvedDiscountAmount = isDiscountApproved ? currentDiscountAmount : 0;

    if (selectedRequest.order_id) {
      // Takeaway/Delivery path.
      const currentOrder = selectedBillOrders.find((o) => o.id === selectedRequest.order_id) || selectedBillOrders[0];
      const orderSubtotal = Number(currentOrder?.subtotal || 0);
      const deliveryCharge = Number(currentOrder?.delivery_charge || 0);
      const newTotal = Math.max(0, Number((orderSubtotal - approvedDiscountAmount + deliveryCharge).toFixed(2)));

      const { error: orderPaidError } = await supabase
        .from("orders")
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          status: "COMPLETED",
          discount: approvedDiscountAmount,
          total: newTotal,
        })
        .eq("id", selectedRequest.order_id);

      if (orderPaidError) {
        console.error(orderPaidError);
        setMarkStatus("error");
        setMarking(false);
        return;
      }
    } else {
      // Dine-in path.
      const sessionOrderIds = selectedBillOrders.map((order) => order.id);

      if (sessionOrderIds.length > 0) {
        let remainingDiscount = approvedDiscountAmount;

        for (let i = 0; i < selectedBillOrders.length; i++) {
          const order = selectedBillOrders[i];
          const orderSub = Number(order.subtotal || 0);
          const isLast = i === selectedBillOrders.length - 1;

          let allocatedDiscount = 0;
          if (approvedDiscountAmount > 0 && originalSubtotal > 0) {
            if (isLast) {
              allocatedDiscount = Number(remainingDiscount.toFixed(2));
            } else {
              allocatedDiscount = Number(((orderSub / originalSubtotal) * approvedDiscountAmount).toFixed(2));
              remainingDiscount -= allocatedDiscount;
            }
          }

          const deliveryCharge = Number(order.delivery_charge || 0);
          const newOrderTotal = Math.max(0, Number((orderSub - allocatedDiscount + deliveryCharge).toFixed(2)));

          const { error: orderPaidError } = await supabase
            .from("orders")
            .update({
              status: "COMPLETED",
              paid: true,
              paid_at: new Date().toISOString(),
              discount: allocatedDiscount,
              total: newOrderTotal,
            })
            .eq("id", order.id);

          if (orderPaidError) {
            console.error(orderPaidError);
            setMarkStatus("error");
            setMarking(false);
            return;
          }
        }
      }

      // End the session — unconditional. This must happen whether the
      // customer ever tapped "Request Bill" or staff generated the bill
      // manually from Running Tables, so a session never lingers "active"
      // after payment (which would otherwise leak into the next customer).
      if (selectedRequest.session_id) {
        const { error: sessionError } = await supabase
          .from("table_sessions")
          .update({
            status: "completed",
            ended_at: new Date().toISOString(),
            bill_requested: false,
            bill_requested_at: null,
          })
          .eq("id", selectedRequest.session_id);

     if (sessionError) {
  alert(JSON.stringify(sessionError, null, 2));
  console.error(sessionError);
  setMarkStatus("error");
  setMarking(false);
  return;
}
      }

      // Free the table and clear current_session_id.
  const { data: tableData, error: tableError } = await supabase
  .from("tables")
  .update({
    status: "FREE",
    current_session_id: null,
  })
  .eq("id", selectedRequest.table_id)
  .select();

console.log("TABLE UPDATE RESULT:", tableData);
console.log("TABLE UPDATE ERROR:", tableError);
console.log("TABLE ID USED:", selectedRequest.table_id);

     if (tableError) {
  alert(JSON.stringify(tableError, null, 2));
  console.error(tableError);
  setMarkStatus("error");
  setMarking(false);
  return;
}
    }

    // Insert payment record into payments table
    const { error: paymentInsertError } = await supabase
      .from("payments")
      .insert({
        order_id: selectedRequest.order_id || null,
        session_id: selectedRequest.session_id || null,
        amount: grandTotal,
        tip: Number(tipAmount) || 0,
        payment_mode: paymentMode,
        paid_at: new Date().toISOString(),
      });

    if (paymentInsertError) {
      console.error("Failed to insert payment record:", paymentInsertError);
      alert("Payment recorded locally but failed to save to database. Please notify management.");
      // Continue anyway since orders are already marked as paid
    }

    // Payment mode + tip are also kept in memory for UI display
    setRecentPayments((prev) => [
      {
        tableDisplay: selectedRequest.table_display,
        grandTotal,
        tip: Number(tipAmount) || 0,
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
    <main className="p-6">
      Checking access...
    </main>
  );
}
  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="print:hidden">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900">
          Cash Counter Dashboard
        </h1>

        <div className="mb-6">
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
            className={`px-4 py-2 rounded-lg text-white font-medium ${
              soundEnabled ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {soundEnabled ? "🔔 Notifications ON" : "🔕 Notifications OFF"}
          </button>
        </div>

        {/* DAILY SUMMARY */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm text-gray-500">Today's Orders</p>
            <p className="text-2xl font-bold text-gray-900">{todaysOrders.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm text-gray-500">Today's Sales</p>
            <p className="text-2xl font-bold text-gray-900">₹{todaysSales}</p>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm text-gray-500">Pending Bill Requests</p>
            <p className="text-2xl font-bold text-gray-900">{billRequests.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-sm text-gray-500">Today's Completed Orders</p>
            <p className="text-2xl font-bold text-gray-900">
              {todaysCompletedOrders.length}
            </p>
          </div>
        </div>
        <h2 className="text-xl font-bold mb-4 text-gray-900">
  Pending Approvals ({pendingApprovals.length})
</h2>

<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
  {pendingApprovals.map((order) => (
    <div
      key={order.id}
      className="bg-white rounded-xl shadow p-4"
    >
      <p className="font-bold">
        {order.customer_name || "Customer"}
      </p>

      <p className="text-sm text-gray-500">
        {order.phone_number}
      </p>

      <p className="text-sm text-gray-500">
        {order.order_mode}
      </p>
      {order.order_mode === "delivery" &&
  order.delivery_address && (
    <p className="text-sm text-gray-500 mt-1">
      📍 {order.delivery_address}
    </p>
)}

      {itemsForOrder(order.id).length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-gray-700">Items:</p>
          <ul className="ml-4 mt-1 list-disc text-sm text-gray-700">
            {itemsForOrder(order.id).map((item: any, index: number) => (
              <li key={index}>
                {item.menu_items?.name} × {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="font-bold mt-2">
        ₹{order.total}
      </p>

      <div className="flex gap-2 mt-4">
        <button
          onClick={async () => {
            await supabase
              .from("orders")
              .update({ status: "NEW" })
              .eq("id", order.id)
              .eq("status", "PENDING_APPROVAL");

            loadData();
          }}
          className="flex-1 bg-green-600 text-white px-3 py-2 rounded"
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
          className="flex-1 bg-red-600 text-white px-3 py-2 rounded"
        >
          Reject
        </button>
      </div>
    </div>
  ))}
</div>

{/* ACTIVE ORDERS — Takeaway/Delivery only. Status is owned entirely by
    Kitchen (NEW -> PREPARING -> READY) and Service Staff (READY ->
    COMPLETED); this is a read-only view for front-of-house visibility. */}
<h2 className="text-xl font-bold mb-4 text-gray-900">
  🛍 Active Orders ({activeOrders.length})
</h2>

<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
  {activeOrders.map((order) => (
    <div key={order.id} className="bg-white rounded-xl shadow p-4">
      <p className="font-bold">{order.customer_name || "Customer"}</p>

      <p className="text-sm text-gray-500">{order.phone_number}</p>

      <p className="text-sm text-gray-500">{order.order_mode}</p>

      {order.order_mode === "delivery" && order.delivery_address && (
        <p className="text-sm text-gray-500 mt-1">
          📍 {order.delivery_address}
        </p>
      )}

      <p className="text-sm font-semibold text-blue-700 mt-2">
        {order.status}
      </p>

      {itemsForOrder(order.id).length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-gray-700">Items:</p>
          <ul className="ml-4 mt-1 list-disc text-sm text-gray-700">
            {itemsForOrder(order.id).map((item: any, index: number) => (
              <li key={index}>
                {item.menu_items?.name} × {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="font-bold mt-3">₹{order.total}</p>
    </div>
  ))}

  {activeOrders.length === 0 && (
    <p className="text-gray-500 col-span-full">
      No active takeaway/delivery orders.
    </p>
  )}
</div>

        {/* RUNNING TABLES */}
        <h2 className="text-xl font-bold mb-4 text-gray-900">
          🍽 Running Tables ({runningTables.length})
        </h2>


        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {runningTables.map((table) => (
            <div key={table.id} className="bg-white rounded-xl shadow p-4">
              <p className="text-lg font-bold text-gray-900">
                Table {table.table_display}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {table.orderCount} order{table.orderCount === 1 ? "" : "s"}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ₹{table.sessionTotal}
              </p>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => toggleExpandTable(table.id)}
                  className="flex-1 bg-gray-200 text-gray-800 px-3 py-2 rounded-lg font-medium text-sm"
                >
                  {expandedTableId === table.id ? "Hide Orders" : "Expand Orders"}
                </button>

                <button
                  onClick={() => openBillForTable(table)}
                  className="flex-1 bg-slate-800 text-white px-3 py-2 rounded-lg font-medium text-sm"
                >
                  Generate Bill
                </button>
              </div>

              {expandedTableId === table.id && (
                <div className="mt-4 border-t pt-3 space-y-3">
                  {table.sessionOrders.map((order: any) => (
                    <div key={order.id}>
                      <p className="text-xs text-gray-500 mb-1">
                        Order #{String(order.id).slice(0, 8)} — {order.status}
                      </p>

                      <ul className="ml-3 list-disc text-sm">
                        {allOrderItems
                          .filter((item) => item.order_id === order.id)
                          .map((item: any, index: number) => (
                            <li key={index}>
                              {item.menu_items?.name} × {item.quantity} — ₹
                              {item.total_price}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}

                  {table.sessionOrders.length === 0 && (
                    <p className="text-sm text-gray-500">No orders in this session.</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {runningTables.length === 0 && (
            <p className="text-gray-500 col-span-full">No tables currently occupied.</p>
          )}
        </div>
        {/* BILL REQUESTS */}
        <h2 className="text-xl font-bold mb-4 text-gray-900">
          🧾 Bill Requests ({billRequests.length})
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {billRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-xl shadow p-4 flex flex-col justify-between"
            >
              <div>
                <p className="text-lg font-bold text-gray-900">
                  Table {request.table_display}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Requested {new Date(request.created_at).toLocaleTimeString()}
                </p>
              </div>

              <button
                onClick={() => openBill(request.id)}
                className="mt-4 bg-slate-800 text-white px-4 py-2 rounded-lg font-medium"
              >
                View Bill
              </button>
            </div>
          ))}

          {billRequests.length === 0 && (
            <p className="text-gray-500 col-span-full">No pending bill requests.</p>
          )}
        </div>

        {/* READY FOR BILLING — Takeaway/Delivery only. Appears once
            status is COMPLETED and disappears once Mark Paid sets
            paid = true. Reuses the same bill modal as dine-in, via
            openBillForOrder / the order_id branch below. */}
        <h2 className="text-xl font-bold mb-4 text-gray-900">
          💰 Ready For Billing ({readyForBillingOrders.length})
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {readyForBillingOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow p-4 flex flex-col justify-between"
            >
              <div>
                <p className="font-bold text-gray-900">
                  {order.customer_name || "Customer"}
                </p>
                <p className="text-sm text-gray-500">{order.phone_number}</p>
                <p className="text-sm text-gray-500">{order.order_mode}</p>

                {order.order_mode === "delivery" && order.delivery_address && (
                  <p className="text-sm text-gray-500 mt-1">
                    📍 {order.delivery_address}
                  </p>
                )}

                {itemsForOrder(order.id).length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-gray-700">Items:</p>
                    <ul className="ml-4 mt-1 list-disc text-sm text-gray-700">
                      {itemsForOrder(order.id).map((item: any, index: number) => (
                        <li key={index}>
                          {item.menu_items?.name} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="font-bold mt-3 text-gray-900">₹{order.total}</p>
              </div>

              <button
                onClick={() => openBillForOrder(order)}
                className="mt-4 bg-slate-800 text-white px-4 py-2 rounded-lg font-medium"
              >
                Generate Bill
              </button>
            </div>
          ))}

          {readyForBillingOrders.length === 0 && (
            <p className="text-gray-500 col-span-full">
              No completed takeaway/delivery orders awaiting billing.
            </p>
          )}
        </div>
      </div>

      {/* BILL DETAILS / PAYMENT / PRINT */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center z-50 p-3 print:static print:bg-white print:p-0">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none">
            <div id="printable-invoice" className="p-6">
              <div className="flex items-start justify-between mb-4 print:hidden">
                <h2 className="text-xl font-bold text-gray-900">Bill Details</h2>
                <button
                  onClick={closeBill}
                  className="text-gray-500 text-sm border rounded px-2 py-1"
                >
                  Close
                </button>
              </div>

              {/* Invoice header */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-2xl font-bold text-gray-900">Invoice</h3>
                {selectedRequest.order_id ? (
                  <>
                    <p className="text-gray-600 mt-1">
                      {selectedRequest.table_display}:{" "}
                      <strong>{selectedRequest.customer_name || "—"}</strong>
                    </p>
                    {selectedRequest.phone_number && (
                      <p className="text-gray-500 text-sm">
                        {selectedRequest.phone_number}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-600 mt-1">
                    Table: <strong>{selectedRequest.table_display}</strong>
                  </p>
                )}
                <p className="text-gray-500 text-sm">
                  {new Date().toLocaleString()}
                </p>
              </div>

              {/* Orders + items */}
              <div className="space-y-4 mb-4">
                {selectedBillOrders.map((order) => (
                  <div key={order.id} className="border-b pb-3">
                    <p className="text-sm text-gray-500 mb-2">
                      Order #{String(order.id).slice(0, 8)} — {order.status}
                    </p>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="pb-1">Item</th>
                          <th className="pb-1 text-center">Qty</th>
                          <th className="pb-1 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.order_items.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="py-1">{item.menu_items?.name}</td>
                            <td className="py-1 text-center">{item.quantity}</td>
                            <td className="py-1 text-right">₹{item.total_price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {selectedBillOrders.length === 0 && (
                  <p className="text-gray-500 text-sm">No orders found for this table.</p>
                )}
              </div>

              {/* SUBTOTAL, DISCOUNT SYSTEM UI & GRAND TOTAL */}
              <div className="border-t pt-3 mb-4 text-gray-900">
                {/* Subtotal */}
                <div className="flex items-center justify-between">
                  <p className="text-md font-medium text-gray-700">Subtotal</p>
                  <p className="text-md font-medium text-gray-900">₹{originalSubtotal}</p>
                </div>

                {/* DISCOUNT SYSTEM CONTROLS & STATUS (ABOVE GRAND TOTAL) */}
                <div className="print:hidden my-3">
                  {!activeDiscountRow ? (
                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Apply Discount</p>
                        {discountValueInput !== "" && Number(discountValueInput) > 0 && originalSubtotal > 0 && (
                          <span className="text-xs text-gray-600">
                            Calculated: <strong className="text-gray-900">₹{previewDiscountAmount}</strong> ({previewPercentage.toFixed(1)}%)
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 items-center">
                        <select
                          value={discountTypeInput}
                          onChange={(e) => setDiscountTypeInput(e.target.value as "FIXED" | "PERCENTAGE")}
                          className="border border-gray-300 p-2 rounded text-sm w-32 bg-white text-gray-900"
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
                          className="border border-gray-300 p-2 rounded flex-1 text-sm bg-white text-gray-900"
                        />
                        <button
                          onClick={handleApplyDiscount}
                          disabled={discountValueInput === "" || Number(discountValueInput) <= 0 || originalSubtotal <= 0}
                          className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition"
                        >
                          Apply
                        </button>
                      </div>

                      {discountValueInput !== "" && Number(discountValueInput) > 0 && originalSubtotal > 0 && (
                        <div className="mt-2 text-xs">
                          {previewDiscountAmount > originalSubtotal ? (
                            <p className="text-red-600 font-medium">⚠️ Discount amount cannot exceed subtotal (₹{originalSubtotal})</p>
                          ) : previewPercentage <= 10 ? (
                            <p className="text-green-700 font-medium">⚡ Instant Auto-Approval (≤ 10% threshold)</p>
                          ) : (
                            <p className="text-amber-700 font-medium">⏳ Requires Owner Approval (&gt; 10% threshold)</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : activeDiscountRow.status === "PENDING" ? (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded">
                              ⏳ PENDING APPROVAL
                            </span>
                            <span className="text-xs text-amber-700">Waiting for Owner</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {activeDiscountRow.discount_type === "PERCENTAGE"
                              ? `${activeDiscountRow.discount_value}% Discount`
                              : `₹${activeDiscountRow.discount_value} Flat Discount`}
                            {" — "}
                            <span className="text-amber-700 font-bold">₹{activeDiscountRow.discount_amount} off</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Payment collection is locked until the owner approves or rejects this request.
                          </p>
                        </div>
                        {!isBillPaid && (
                          <button
                            onClick={removeDiscount}
                            className="text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 bg-white hover:bg-red-50 px-2.5 py-1 rounded"
                          >
                            Cancel Request
                          </button>
                        )}
                      </div>
                    </div>
                  ) : activeDiscountRow.status === "APPROVED" || activeDiscountRow.status === "AUTO_APPROVED" ? (
                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded">
                              {activeDiscountRow.status === "AUTO_APPROVED" ? "⚡ AUTO-APPROVED" : "✅ APPROVED"}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-green-900 mt-1">
                            {activeDiscountRow.discount_type === "PERCENTAGE"
                              ? `${activeDiscountRow.discount_value}% Discount`
                              : `₹${activeDiscountRow.discount_value} Flat Discount`}
                            {" — "}
                            <span className="font-bold text-green-700">-₹{activeDiscountRow.discount_amount}</span>
                          </p>
                        </div>
                        {!isBillPaid && (
                          <button
                            onClick={removeDiscount}
                            className="text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 bg-white hover:bg-red-50 px-2.5 py-1 rounded"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ) : activeDiscountRow.status === "REJECTED" ? (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded">
                              ❌ REJECTED
                            </span>
                            <span className="text-xs text-red-700">Rejected by Owner</span>
                          </div>
                          <p className="text-sm text-gray-800 mt-1">
                            Discount request of{" "}
                            {activeDiscountRow.discount_type === "PERCENTAGE"
                              ? `${activeDiscountRow.discount_value}%`
                              : `₹${activeDiscountRow.discount_value}`}{" "}
                            (₹{activeDiscountRow.discount_amount}) was declined.
                          </p>
                        </div>
                        {!isBillPaid && (
                          <button
                            onClick={removeDiscount}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded"
                          >
                            Dismiss / Re-apply
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Invoice discount line (print & summary) */}
                {activeDiscountRow && (activeDiscountRow.status === "APPROVED" || activeDiscountRow.status === "AUTO_APPROVED") ? (
                  <div className="flex items-center justify-between text-green-700 py-1">
                    <p className="text-sm font-medium">
                      Discount ({activeDiscountRow.discount_type === "PERCENTAGE" ? `${activeDiscountRow.discount_value}%` : `₹${activeDiscountRow.discount_value}`})
                    </p>
                    <p className="text-sm font-bold">-₹{activeDiscountRow.discount_amount}</p>
                  </div>
                ) : activeDiscountRow && activeDiscountRow.status === "PENDING" ? (
                  <div className="flex items-center justify-between text-amber-600 py-1 print:hidden">
                    <p className="text-sm font-medium">
                      Discount ({activeDiscountRow.discount_type === "PERCENTAGE" ? `${activeDiscountRow.discount_value}%` : `₹${activeDiscountRow.discount_value}`})
                    </p>
                    <p className="text-xs font-semibold">Pending Approval (₹{activeDiscountRow.discount_amount})</p>
                  </div>
                ) : null}

                {/* Grand Total */}
                <div className="flex items-center justify-between border-t mt-2 pt-2">
                  <p className="text-lg font-bold text-gray-900">Grand Total</p>
                  <p className="text-lg font-bold text-gray-900">₹{grandTotal}</p>
                </div>
              </div>

              {/* PAYMENT SECTION */}
              <div className="print:hidden space-y-3 border-t pt-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full border p-2 rounded"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    Tip Amount
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tipAmount}
                    onChange={(e) => setTipAmount(Number(e.target.value))}
                    className="w-full border p-2 rounded"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="font-semibold text-gray-700">Final Amount Received</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₹{finalAmountReceived}
                  </p>
                </div>
              </div>

              {/* Print-only payment summary */}
              <div className="hidden print:block border-t pt-3 mt-3 text-sm">
                <p>Payment Mode: {paymentMode}</p>
                <p>Tip: ₹{tipAmount}</p>
                <p className="font-bold">Final Amount: ₹{finalAmountReceived}</p>
              </div>
            </div>

            <div className="p-6 pt-0 flex flex-col gap-2 print:hidden">
              <div className="flex gap-3">
                <button
                  onClick={printBill}
                  className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg font-medium"
                >
                  🖨 Print Bill
                </button>

                <button
                  onClick={markPaid}
                  disabled={
                    marking ||
                    markStatus === "success" ||
                    !canTakePayment
                  }
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium disabled:opacity-60"
                >
                  {markStatus === "success"
                    ? "✅ Paid"
                    : marking
                    ? "Processing..."
                    : "Mark Paid"}
                </button>
              </div>

              {!canTakePayment && isDiscountPending && (
                <p className="text-amber-600 text-sm text-center">
                  ⏳ Payment locked: Discount approval is pending owner review.
                </p>
              )}
              {!canTakePayment && !isDiscountPending && selectedBillOrders.length > 0 && (
                <p className="text-orange-600 text-sm text-center">
                  Food must be served before payment.
                </p>
              )}
            </div>

            {markStatus === "error" && (
              <p className="text-red-600 text-sm px-6 pb-4 print:hidden">
                ⚠️ Something went wrong. Please try again.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent payments (this session only, not persisted) */}
      {recentPayments.length > 0 && (
        <div className="print:hidden mt-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            Recent Payments (this session)
          </h2>

          <div className="bg-white rounded-xl shadow divide-y">
            {recentPayments.map((payment) => (
              <div key={payment.at} className="p-4 flex justify-between text-sm">
                <div>
                  <p className="font-semibold text-gray-900">
                    {payment.tableDisplay === "Takeaway" ||
                    payment.tableDisplay === "Delivery"
                      ? payment.tableDisplay
                      : `Table ${payment.tableDisplay}`}
                  </p>
                  <p className="text-gray-500">
                    {new Date(payment.at).toLocaleTimeString()} · {payment.mode}
                  </p>
                </div>
                <p className="font-bold text-gray-900">
                  ₹{payment.grandTotal + payment.tip}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}