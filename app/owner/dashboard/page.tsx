/* eslint-disable @typescript-eslint/no-explicit-any */
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
    <main className="owner-page flex items-center justify-center">
      <p className="text-gray-500 font-medium">Checking access...</p>
    </main>
  );
}

  return (
    <main className="owner-page">
      <div className="owner-head">
        <div>
          <div className="owner-eyebrow">Arabian Nights</div>
          <h1 className="owner-title">Owner Dashboard</h1>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/owner/login");
          }}
          className="admin-btn admin-btn-primary"
        >
          Logout
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 font-medium text-center py-10">Loading dashboard...</p>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="owner-section">
            <div className="owner-grid-summary">
              <div className="owner-summary-card">
                <p className="owner-summary-label">Today&apos;s Sales</p>
                <p className="owner-summary-value">₹{todaysSales}</p>
              </div>

              <div className="owner-summary-card">
                <p className="owner-summary-label">Today&apos;s Orders</p>
                <p className="owner-summary-value">
                  {todaysOrders.length}
                </p>
              </div>

              <div className="owner-summary-card">
                <p className="owner-summary-label">Monthly Sales</p>
                <p className="owner-summary-value">₹{monthlySales}</p>
              </div>

              <div className="owner-summary-card">
                <p className="owner-summary-label">Monthly Orders</p>
                <p className="owner-summary-value">
                  {monthOrders.length}
                </p>
              </div>

              <div className="owner-summary-card">
                <p className="owner-summary-label">Cancelled This Month</p>
                <p className="owner-summary-value">
                  {cancelledThisMonth.length}
                </p>
              </div>

              <div className="owner-summary-card">
                <p className="owner-summary-label">Active Owners</p>
                <p className="owner-summary-value">
                  {activeOwnersCount}
                </p>
              </div>
            </div>
          </div>

          {/* SALES ANALYTICS */}
          <div className="owner-section">
            <div className="owner-section-head">
              <h2 className="owner-section-title pr-4">Sales Analytics</h2>
            </div>

            <div className="owner-card">
              <div className="owner-filter-bar">
                {(["today", "7d", "30d", "custom"] as RangeKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setRange(key)}
                    className={`owner-filter-btn ${
                      range === key
                        ? "owner-filter-btn-active"
                        : ""
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
                <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-[rgba(0,0,0,0.2)] rounded-lg border border-[var(--color-hairline)]">
                  <div>
                    <label className="owner-input-label">From</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="owner-input"
                    />
                  </div>
                  <div>
                    <label className="owner-input-label">To</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="owner-input"
                    />
                  </div>
                  <button
                    onClick={applyCustomRange}
                    disabled={customLoading || !customStart || !customEnd}
                    className="admin-btn admin-btn-primary disabled:opacity-50 !py-[0.6rem]"
                  >
                    {customLoading ? "Loading..." : "Apply"}
                  </button>
                </div>
              )}

              <p className="text-sm text-[var(--color-gold)] opacity-80 mb-4 font-medium uppercase tracking-wider">{rangeLabel}</p>

              <div className="owner-grid-sales">
                <div className="owner-sales-metric">
                  <p className="owner-summary-label">Total Sales</p>
                  <p className="text-2xl font-bold text-[var(--color-ivory)] mt-1">
                    ₹{rangeTotalSales}
                  </p>
                </div>
                <div className="owner-sales-metric">
                  <p className="owner-summary-label">Cash Sales</p>
                  <p className="text-xl font-bold text-[var(--color-ivory-muted)] mt-1">₹{cashSales}</p>
                </div>
                <div className="owner-sales-metric">
                  <p className="owner-summary-label">UPI Sales</p>
                  <p className="text-xl font-bold text-[var(--color-ivory-muted)] mt-1">₹{upiSales}</p>
                </div>
                <div className="owner-sales-metric">
                  <p className="owner-summary-label">Card Sales</p>
                  <p className="text-xl font-bold text-[var(--color-ivory-muted)] mt-1">₹{cardSales}</p>
                </div>
              </div>

              {rangePayments.length === 0 && (
                <p className="text-sm text-[var(--color-gold)] bg-[rgba(212,175,55,0.05)] border border-[var(--color-hairline)] rounded-md p-3 mb-6">
                  No payment records yet — Cash/UPI/Card breakdown will populate
                  automatically once payments start being recorded to the
                  database. Total Sales above is accurate today (computed from
                  orders); the breakdown is not yet, since payment mode isn&apos;t
                  persisted anywhere currently.
                </p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* REVENUE TREND */}
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ivory)] uppercase tracking-wider mb-2">
                    Revenue Trend
                  </p>
                  {trendByDay.length === 0 ? (
                    <p className="text-sm text-[var(--color-ivory-muted)]">No orders in this range.</p>
                  ) : (
                    <div className="owner-chart-wrap">
                      {trendByDay.map((d) => (
                        <div
                          key={d.date}
                          className="owner-chart-bar-wrap"
                          title={`${d.date}: ₹${d.total}`}
                        >
                          <div
                            className="owner-chart-bar"
                            style={{
                              height: `${(d.total / maxTrendValue) * 100}%`,
                              minHeight: d.total > 0 ? "4px" : "0px",
                            }}
                          />
                          <p className="owner-chart-label">
                            {d.date.slice(5)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PAYMENT METHOD BREAKDOWN */}
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ivory)] uppercase tracking-wider mb-4 lg:mb-2">
                    Payment Method Breakdown
                  </p>
                  <div className="pt-2">
                    {[
                      { label: "Cash", value: cashSales, color: "bg-[var(--color-gold)]" },
                      { label: "UPI", value: upiSales, color: "bg-blue-500" },
                      { label: "Card", value: cardSales, color: "bg-purple-500" },
                    ].map((row) => {
                      const max = Math.max(1, cashSales, upiSales, cardSales);
                      return (
                        <div key={row.label} className="owner-breakdown-row">
                          <span className="owner-breakdown-label">{row.label}</span>
                          <div className="owner-breakdown-track">
                            <div
                              className={`owner-breakdown-fill ${row.color}`}
                              style={{ width: `${(row.value / max) * 100}%` }}
                            />
                          </div>
                          <span className="owner-breakdown-value">
                            ₹{row.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DISCOUNTS OVERVIEW */}
          <div className="owner-section">
            <div className="owner-section-head">
              <h2 className="owner-section-title pr-4">Discounts Overview</h2>
            </div>

            <div className="owner-card p-0">
              <div className="owner-table-wrapper">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th className="pl-6">Order/Session Info</th>
                      <th>Subtotal</th>
                      <th>Discount</th>
                      <th>Effective %</th>
                      <th>Requested At</th>
                      <th className="text-center">Status</th>
                      <th>Approver</th>
                      <th className="text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDiscounts.map((discount) => {
                      const effectivePercent = ((discount.discount_amount / discount.original_subtotal) * 100).toFixed(1);
                      let statusClass = "owner-badge-neutral";
                      if (discount.status === "PENDING") statusClass = "owner-badge-amber";
                      if (discount.status === "APPROVED" || discount.status === "AUTO_APPROVED") statusClass = "owner-badge-green";
                      if (discount.status === "REJECTED") statusClass = "owner-badge-red";

                      const identifier = discount.orders?.customer_name
                        ? `Order: ${discount.orders.customer_name}`
                        : `Table ${discount.table_sessions?.tables?.table_number || discount.orders?.table_id || "Unk"}`;

                      const approverLine = discount.status === "AUTO_APPROVED"
                        ? "System"
                        : discount.owners?.email || "—";

                      return (
                        <tr key={discount.id}>
                          <td className="pl-6">{identifier}</td>
                          <td className="font-semibold">₹{discount.original_subtotal}</td>
                          <td className="text-[var(--color-ivory-muted)]">
                            {discount.discount_type === "PERCENTAGE" ? `${discount.discount_value}%` : `₹${discount.discount_value}`} <br/>
                            <span className="text-xs">(-₹{discount.discount_amount})</span>
                          </td>
                          <td>{effectivePercent}%</td>
                          <td className="text-sm text-[var(--color-ivory-muted)]">{new Date(discount.requested_at).toLocaleString()}</td>
                          <td className="text-center">
                            <span className={`owner-badge ${statusClass}`}>
                              {discount.status}
                            </span>
                          </td>
                          <td className="text-sm opacity-80">{approverLine}</td>
                          <td className="text-right pr-6">
                            {discount.status === "PENDING" && (
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => resolveDiscount(discount.id, "APPROVED")}
                                  className="owner-btn owner-btn-green"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => resolveDiscount(discount.id, "REJECTED")}
                                  className="owner-btn owner-btn-red"
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
                        <td colSpan={8} className="py-8 text-center text-[var(--color-ivory-muted)]">
                          No discounts requested in the last 31 days.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* MENU PERFORMANCE */}
          <div className="owner-section">
            <div className="owner-section-head">
              <h2 className="owner-section-title pr-4">Menu Performance</h2>
            </div>

            <p className="text-sm text-[var(--color-gold)] opacity-80 mb-4 font-medium uppercase tracking-wider">Top Selling Items</p>

            <div className="owner-card p-0">
              <div className="owner-table-wrapper">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th className="pl-6">Item Name</th>
                      <th className="text-center">Quantity Sold</th>
                      <th className="text-right pr-6">Revenue Generated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item, index) => (
                      <tr key={index}>
                        <td className="pl-6 font-medium">{item.name}</td>
                        <td className="text-center">
                          <span className="bg-[rgba(255,255,255,0.05)] px-3 py-1 rounded-md text-[var(--color-gold)] font-bold">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="text-right pr-6 font-bold text-[var(--color-gold)]">₹{item.revenue}</td>
                      </tr>
                    ))}

                    {topItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-[var(--color-ivory-muted)]">
                          No completed orders in the last 31 days yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* OWNER MANAGEMENT */}
          <div className="owner-section">
            <div className="owner-section-head">
              <h2 className="owner-section-title pr-4">Owner Management</h2>
            </div>

            <div className="owner-card p-0">
              <div className="owner-table-wrapper">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th className="pl-6">Owner Email</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th className="text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {owners.map((owner) => (
                      <tr key={owner.id}>
                        <td className="pl-6">{owner.email}</td>
                        <td>
                          <span
                            className={`owner-badge ${
                              owner.status === "active"
                                ? "owner-badge-green"
                                : "owner-badge-neutral"
                            }`}
                          >
                            {owner.status}
                          </span>
                        </td>
                        <td className="text-sm text-[var(--color-ivory-muted)]">
                          {owner.last_login
                            ? new Date(owner.last_login).toLocaleString()
                            : "Never"}
                        </td>
                        <td className="text-right pr-6">
                          {owner.status === "active" && (
                            <button
                              onClick={() => removeOwner(owner.id, owner.email)}
                              className="owner-btn owner-btn-red"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {owners.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[var(--color-ivory-muted)]">
                          No owners added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECURITY CENTER */}
          <div className="owner-section">
            <div className="owner-section-head">
              <h2 className="owner-section-title pr-4">Security Center</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                "Login Alerts",
                "Password Changes",
                "Password Resets",
                "Owner Added",
                "Owner Removed",
              ].map((label) => (
                <div key={label} className="owner-card">
                  <p className="owner-summary-label">{label}</p>
                  <p className="text-sm text-[var(--color-ivory-muted)] mt-2 italic">
                    No events
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* REPORTS */}
          <div className="owner-section pb-8">
            <div className="owner-section-head">
              <h2 className="owner-section-title pr-4">Reports</h2>
            </div>

            <div className="owner-card">
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() =>
                    alert("Daily Report generation will be available in a future phase.")
                  }
                  className="owner-btn owner-btn-primary"
                >
                  Daily Report
                </button>
                <button
                  onClick={() =>
                    alert("Monthly Report generation will be available in a future phase.")
                  }
                  className="owner-btn owner-btn-primary"
                >
                  Monthly Report
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
