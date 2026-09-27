"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, uniqueChannelTopic } from "../../../lib/supabase";

// PHASE 1 NOTE: this page has no auth/session guard yet (see
// /owner/login). It is also strictly READ-ONLY against orders/payments
// — Owner Management (owners table) is the only place this page
// writes to. No order deletion, no sales editing, no revenue editing,
// no paid-order modification anywhere below.

type RangeKey = "today" | "7d" | "30d" | "custom";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function dateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

// Local calendar-date key (YYYY-MM-DD), used specifically for "is this
// today?" checks. Deliberately built from local getFullYear/getMonth/
// getDate rather than toISOString() (UTC) — created_at is a UTC
// instant, and comparing it via a UTC-derived boundary or calendar
// date can disagree with the viewer's actual local "today".
function localDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  // ---- Core data (loaded once, last 31 days is enough to cover
  // Today / Last 7 Days / Last 30 Days / month-to-date) ----
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentOrderItems, setRecentOrderItems] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [currentOwner, setCurrentOwner] = useState<any>(null);
  const [recentDiscounts, setRecentDiscounts] = useState<any[]>([]);
  // ---- Sales Analytics range selector ----
  const [range, setRange] = useState<RangeKey>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customOrders, setCustomOrders] = useState<any[] | null>(null);
  const [customPayments, setCustomPayments] = useState<any[] | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  // ---- Owner Management (Remove only) ----

  const loadCoreData = async () => {
    setLoading(true);

    const since = new Date();
    since.setDate(since.getDate() - 31);

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (ordersError) console.error(ordersError);

    const orders = ordersData ?? [];
    const orderIds = orders.map((o) => o.id);

    const { data: itemsData, error: itemsError } = await supabase
      .from("order_items")
      .select(`*, menu_items ( name )`)
      .in("order_id", orderIds.length > 0 ? orderIds : ["00000000-0000-0000-0000-000000000000"]);

    if (itemsError) console.error(itemsError);

    // Reads from `payments` — will be empty today since nothing writes
    // to it yet (see migration notes). Query is here so the section
    // starts working the moment that changes, with no further code
    // changes needed on this page.
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .gte("paid_at", since.toISOString());

    if (paymentsError) console.error(paymentsError);

    const { data: ownersData, error: ownersError } = await supabase
      .from("owners")
      .select("*")
      .order("created_at", { ascending: true });

    if (ownersError) console.error(ownersError);

    const { data: discountsData, error: discountsError } = await supabase
      .from("discounts")
      .select(`
        *,
        owners ( email ),
        orders ( customer_name, table_id ),
        table_sessions ( session_token, tables!table_sessions_table_id_fkey ( table_number ) )
      `)
      .gte("requested_at", since.toISOString())
      .order("requested_at", { ascending: false });

    if (discountsError) console.error(discountsError);

    setRecentOrders(orders);
    setRecentOrderItems(itemsData ?? []);
    setRecentPayments(paymentsData ?? []);
    setOwners(ownersData ?? []);
    setRecentDiscounts(discountsData ?? []);
    setLoading(false);
  };
  useEffect(() => {
    // Realtime channels are created SYNCHRONOUSLY here, before any await.
    // This matters: RealtimeClient.channel() returns an already-registered
    // channel when the topic matches, and RealtimeChannel.on() throws if that
    // channel has already joined/joinedOnce. Creating them after an await
    // (as this effect used to do) let a remount's cleanup — whose removeChannel
    // is async — race the new subscription, so .on() hit a still-live channel
    // and threw "cannot add postgres_changes callbacks ... after subscribe()".
    let cancelled = false;

    const discountsChannel = supabase
      .channel(uniqueChannelTopic("owner-discounts"))
      .on("postgres_changes", { event: "*", schema: "public", table: "discounts" }, () =>
        loadCoreData()
      );

    const ordersChannel = supabase
      .channel(uniqueChannelTopic("owner-orders"))
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        loadCoreData()
      );

    const paymentsChannel = supabase
      .channel(uniqueChannelTopic("owner-payments"))
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () =>
        loadCoreData()
      );

    const initialize = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        router.replace("/owner/login");
        return;
      }

      const { data: owner } = await supabase
        .from("owners")
        .select("*")
        .eq("email", session.user.email)
        .eq("status", "active")
        .single();

      if (cancelled) return;

      if (!owner) {
        await supabase.auth.signOut();
        if (cancelled) return;
        router.replace("/owner/login");
        return;
      }

      setCurrentOwner(owner);
      setCheckingAccess(false);
      loadCoreData();

      // Subscribe only after the access check passes, and only if we are
      // still mounted. .on() is always called before .subscribe() — the
      // handlers are attached above, before the first await.
      discountsChannel.subscribe();
      ordersChannel.subscribe();
      paymentsChannel.subscribe();
    };

    initialize();

    return () => {
      cancelled = true;
      supabase.removeChannel(discountsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [router]);
  // ---- Summary cards ----
  const monthStart = startOfMonth(new Date());
  const todayKey = localDateKey(new Date());

  const todaysOrders = recentOrders.filter(
    (o) => localDateKey(new Date(o.created_at)) === todayKey
  );
  const monthOrders = recentOrders.filter(
    (o) => new Date(o.created_at) >= monthStart
  );
  const cancelledThisMonth = monthOrders.filter(
    (o) => o.status === "CANCELLED"
  );

  const sumSales = (list: any[]) =>
    list
      .filter((o) => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const todaysSales = sumSales(todaysOrders);
  const monthlySales = sumSales(monthOrders);
  const activeOwnersCount = owners.filter((o) => o.status === "active").length;

  // ---- Sales Analytics: orders + payments for the selected range ----
  const rangeOrders = useMemo(() => {
    if (range === "custom") return customOrders ?? [];

    const cutoff = new Date();
    if (range === "today") {
      return recentOrders.filter(
        (o) => localDateKey(new Date(o.created_at)) === todayKey
      );
    }
    if (range === "7d") {
      cutoff.setDate(cutoff.getDate() - 7);
      cutoff.setHours(0, 0, 0, 0);
      return recentOrders.filter((o) => new Date(o.created_at) >= cutoff);
    }
    // 30d
    cutoff.setDate(cutoff.getDate() - 30);
    cutoff.setHours(0, 0, 0, 0);
    return recentOrders.filter((o) => new Date(o.created_at) >= cutoff);
  }, [range, recentOrders, customOrders, todayKey]);

  const rangePayments = useMemo(() => {
    if (range === "custom") return customPayments ?? [];

    const cutoff = new Date();
    if (range === "today") {
      return recentPayments.filter(
        (p) => localDateKey(new Date(p.paid_at)) === todayKey
      );
    }
    if (range === "7d") {
      cutoff.setDate(cutoff.getDate() - 7);
      cutoff.setHours(0, 0, 0, 0);
      return recentPayments.filter((p) => new Date(p.paid_at) >= cutoff);
    }
    // 30d
    cutoff.setDate(cutoff.getDate() - 30);
    cutoff.setHours(0, 0, 0, 0);
    return recentPayments.filter((p) => new Date(p.paid_at) >= cutoff);
  }, [range, recentPayments, customPayments, todayKey]);

  const rangeTotalSales = sumSales(rangeOrders);
  const cashSales = rangePayments
    .filter((p) => p.payment_mode === "CASH")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const upiSales = rangePayments
    .filter((p) => p.payment_mode === "UPI")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const cardSales = rangePayments
    .filter((p) => p.payment_mode === "CARD")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const applyCustomRange = async () => {
    if (!customStart || !customEnd) return;

    setCustomLoading(true);

    const startIso = new Date(customStart).toISOString();
    const endIso = new Date(
      new Date(customEnd).setHours(23, 59, 59, 999)
    ).toISOString();

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true });

    if (ordersError) console.error(ordersError);

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .gte("paid_at", startIso)
      .lte("paid_at", endIso);

    if (paymentsError) console.error(paymentsError);

    setCustomOrders(ordersData ?? []);
    setCustomPayments(paymentsData ?? []);
    setCustomLoading(false);
  };

  // ---- Revenue trend (simple day-by-day bar chart, no charting lib) ----
  const trendByDay = useMemo(() => {
    const totals = new Map<string, number>();

    rangeOrders
      .filter((o) => o.status !== "CANCELLED")
      .forEach((o) => {
        const key = dateKey(o.created_at);
        totals.set(key, (totals.get(key) || 0) + Number(o.total || 0));
      });

    return Array.from(totals.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, total]) => ({ date, total }));
  }, [rangeOrders]);

  const maxTrendValue = Math.max(1, ...trendByDay.map((d) => d.total));

  // ---- Menu Performance: top selling items (COMPLETED orders only) ----
  const topItems = useMemo(() => {
    const completedOrderIds = new Set(
      recentOrders.filter((o) => o.status === "COMPLETED").map((o) => o.id)
    );

    const byItem = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();

    recentOrderItems
      .filter((item) => completedOrderIds.has(item.order_id))
      .forEach((item) => {
        const key = item.menu_item_id;
        const existing = byItem.get(key) || {
          name: item.menu_items?.name || "Unknown item",
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += Number(item.quantity || 0);
        existing.revenue += Number(item.total_price || 0);
        byItem.set(key, existing);
      });

    return Array.from(byItem.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [recentOrders, recentOrderItems]);

  // ---- Discount Approval Actions ----
  const resolveDiscount = async (discountId: string, status: "APPROVED" | "REJECTED") => {
    if (!currentOwner) return;

    const { error } = await supabase
      .from("discounts")
      .update({
        status,
        approved_by: currentOwner.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", discountId);

    if (error) {
      console.error("Failed to resolve discount", error);
      alert("Failed to update discount status");
    } else {
      loadCoreData();
    }
  };

  // ---- Owner Management actions ----
  // Soft-removal (status -> inactive) rather than a hard delete, so the
  // record and its history survive — reversible if it was a mistake.
  // Swap for a real delete later if that's the preferred behavior.
  const removeOwner = async (id: string, email: string) => {
    if (!confirm(`Remove owner access for ${email}?`)) return;

    const { error } = await supabase
      .from("owners")
      .update({ status: "inactive" })
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    loadCoreData();
  };

  const rangeLabel =
    range === "today"
      ? "Today"
      : range === "7d"
      ? "Last 7 Days"
      : range === "30d"
      ? "Last 30 Days"
      : "Custom Range";
if (checkingAccess) {
  return (
    <main className="p-6">
      Checking access...
    </main>
  );
}

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6">
    <div className="flex justify-between items-center mb-6">
  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
    Owner Dashboard
  </h1>

  <button
    onClick={async () => {
      await supabase.auth.signOut();
      router.push("/owner/login");
    }}
    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
  >
    Logout
  </button>
</div>
      {loading ? (
        <p className="text-gray-500">Loading dashboard...</p>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Today's Sales</p>
              <p className="text-2xl font-bold text-gray-900">₹{todaysSales}</p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Today's Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {todaysOrders.length}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Monthly Sales</p>
              <p className="text-2xl font-bold text-gray-900">₹{monthlySales}</p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Monthly Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {monthOrders.length}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Cancelled This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {cancelledThisMonth.length}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-500">Active Owners</p>
              <p className="text-2xl font-bold text-gray-900">
                {activeOwnersCount}
              </p>
            </div>
          </div>

          {/* SALES ANALYTICS */}
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            📊 Sales Analytics
          </h2>

          <div className="bg-white rounded-xl shadow p-4 mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              {(["today", "7d", "30d", "custom"] as RangeKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`px-4 py-2 rounded font-medium text-sm ${
                    range === key
                      ? "bg-black text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {key === "today"
                    ? "Today"
                    : key === "7d"
                    ? "Last 7 Days"
                    : key === "30d"
                    ? "Last 30 Days"
                    : "Custom Range"}
                </button>
              ))}
            </div>

            {range === "custom" && (
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="border p-2 rounded"
                  />
                </div>
                <button
                  onClick={applyCustomRange}
                  disabled={customLoading || !customStart || !customEnd}
                  className="bg-slate-800 text-white px-4 py-2 rounded disabled:opacity-60"
                >
                  {customLoading ? "Loading..." : "Apply"}
                </button>
              </div>
            )}

            <p className="text-sm text-gray-500 mb-3">{rangeLabel}</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Sales</p>
                <p className="text-xl font-bold text-gray-900">
                  ₹{rangeTotalSales}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Cash Sales</p>
                <p className="text-xl font-bold text-gray-900">₹{cashSales}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">UPI Sales</p>
                <p className="text-xl font-bold text-gray-900">₹{upiSales}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Card Sales</p>
                <p className="text-xl font-bold text-gray-900">₹{cardSales}</p>
              </div>
            </div>

            {rangePayments.length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-6">
                No payment records yet — Cash/UPI/Card breakdown will populate
                automatically once payments start being recorded to the
                database. Total Sales above is accurate today (computed from
                orders); the breakdown is not yet, since payment mode isn't
                persisted anywhere currently.
              </p>
            )}

            {/* REVENUE TREND — plain div bar chart, no charting library */}
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Revenue Trend
            </p>
            {trendByDay.length === 0 ? (
              <p className="text-sm text-gray-500">No orders in this range.</p>
            ) : (
              <div className="flex items-end gap-2 h-40 border-b border-l p-2">
                {trendByDay.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                    title={`${d.date}: ₹${d.total}`}
                  >
                    <div
                      className="w-full bg-slate-700 rounded-t"
                      style={{
                        height: `${(d.total / maxTrendValue) * 100}%`,
                        minHeight: d.total > 0 ? "4px" : "0px",
                      }}
                    />
                    <p className="text-[10px] text-gray-500 mt-1 rotate-0">
                      {d.date.slice(5)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* PAYMENT METHOD BREAKDOWN — plain bar chart */}
            <p className="text-sm font-semibold text-gray-700 mt-6 mb-2">
              Payment Method Breakdown
            </p>
            <div className="space-y-2">
              {[
                { label: "Cash", value: cashSales, color: "bg-green-600" },
                { label: "UPI", value: upiSales, color: "bg-blue-600" },
                { label: "Card", value: cardSales, color: "bg-purple-600" },
              ].map((row) => {
                const max = Math.max(1, cashSales, upiSales, cardSales);
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-14 text-sm text-gray-600">{row.label}</span>
                    <div className="flex-1 bg-gray-100 rounded h-4">
                      <div
                        className={`${row.color} h-4 rounded`}
                        style={{ width: `${(row.value / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-sm text-gray-700">
                      ₹{row.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DISCOUNTS OVERVIEW */}
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            🏷️ Discounts Overview
          </h2>

          <div className="bg-white rounded-xl shadow p-4 mb-8 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Order/Session Info</th>
                  <th className="py-2">Subtotal</th>
                  <th className="py-2">Discount</th>
                  <th className="py-2">Effective %</th>
                  <th className="py-2">Requested At</th>
                  <th className="py-2 text-center">Status</th>
                  <th className="py-2">Approver</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentDiscounts.map((discount) => {
                  const effectivePercent = ((discount.discount_amount / discount.original_subtotal) * 100).toFixed(1);
                  let statusColor = "bg-gray-100 text-gray-700";
                  if (discount.status === "PENDING") statusColor = "bg-amber-100 text-amber-700";
                  if (discount.status === "APPROVED" || discount.status === "AUTO_APPROVED") statusColor = "bg-green-100 text-green-700";
                  if (discount.status === "REJECTED") statusColor = "bg-red-100 text-red-700";

                  const identifier = discount.orders?.customer_name
                    ? `Order: ${discount.orders.customer_name}`
                    : `Table ${discount.table_sessions?.tables?.table_number || discount.orders?.table_id || "Unk"}`;

                  const approverLine = discount.status === "AUTO_APPROVED"
                    ? "System"
                    : discount.owners?.email || "—";

                  return (
                    <tr key={discount.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">{identifier}</td>
                      <td className="py-3">₹{discount.original_subtotal}</td>
                      <td className="py-3">
                        {discount.discount_type === "PERCENTAGE" ? `${discount.discount_value}%` : `₹${discount.discount_value}`} (₹{discount.discount_amount})
                      </td>
                      <td className="py-3">{effectivePercent}%</td>
                      <td className="py-3">{new Date(discount.requested_at).toLocaleString()}</td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                          {discount.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs">{approverLine}</td>
                      <td className="py-3 text-right">
                        {discount.status === "PENDING" && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => resolveDiscount(discount.id, "APPROVED")}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => resolveDiscount(discount.id, "REJECTED")}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {recentDiscounts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-gray-500">
                      No discounts requested in the last 31 days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MENU PERFORMANCE */}
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            🍽 Menu Performance — Top Selling Items
          </h2>

          <div className="bg-white rounded-xl shadow p-4 mb-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Item Name</th>
                  <th className="py-2 text-center">Quantity Sold</th>
                  <th className="py-2 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">₹{item.revenue}</td>
                  </tr>
                ))}

                {topItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-500">
                      No completed orders in the last 31 days yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* OWNER MANAGEMENT */}
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            👤 Owner Management
          </h2>

          <div className="bg-white rounded-xl shadow p-4 mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Owner Email</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Last Login</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((owner) => (
                  <tr key={owner.id} className="border-b last:border-0">
                    <td className="py-2">{owner.email}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          owner.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {owner.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {owner.last_login
                        ? new Date(owner.last_login).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="py-2 text-right">
                      {owner.status === "active" && (
                        <button
                          onClick={() => removeOwner(owner.id, owner.email)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs"
                        >
                          Remove Owner
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {owners.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-500">
                      No owners added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* SECURITY CENTER — static placeholders only, no query, no
              writes. owner_security_events exists in the schema for
              a future phase to start populating. */}
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            🛡 Security Center
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
            {[
              "Login Alerts",
              "Password Changes",
              "Password Resets",
              "Owner Added",
              "Owner Removed",
            ].map((label) => (
              <div key={label} className="bg-white rounded-xl shadow p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-sm text-gray-400 mt-2">
                  No events recorded yet
                </p>
              </div>
            ))}
          </div>

          {/* REPORTS — button stubs only, no report generation yet */}
          <h2 className="text-xl font-bold mb-4 text-gray-900">📄 Reports</h2>

          <div className="bg-white rounded-xl shadow p-4 mb-8 flex flex-wrap gap-3">
            <button
              onClick={() =>
                alert("Daily Report generation will be available in a future phase.")
              }
              className="bg-slate-800 text-white px-4 py-2 rounded"
            >
              Daily Report
            </button>
            <button
              onClick={() =>
                alert("Monthly Report generation will be available in a future phase.")
              }
              className="bg-slate-800 text-white px-4 py-2 rounded"
            >
              Monthly Report
            </button>
          </div>
        </>
      )}
    </main>
  );
}