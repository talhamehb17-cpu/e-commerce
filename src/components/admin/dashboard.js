'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AreaChart, BarChart, Donut, ProgressRing, HBar } from '../charts';
import { StatusPill } from '../ui';
import { toast } from '../toast';
import { RefreshCw, ArrowUpRight, Plus, TrendingUp, Package, Users, Eye, AlertCircle } from '../icons';

const money = (minor) => `Rs ${(Number(minor || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
const percent = (n) => n == null ? '—' : `${n > 0 ? '+' : ''}${n}%`;

const STATUS = [
  ['pending', 'Pending', '#bd8733'], ['confirmed', 'Confirmed', '#557da8'], ['processing', 'Processing', '#376ca1'],
  ['packed', 'Packed', '#647bb2'], ['shipped', 'Shipped', '#755eb5'], ['out_for_delivery', 'Out for delivery', '#8d70ba'],
  ['delivered', 'Delivered', '#378451'], ['cancelled', 'Cancelled', '#ae4d43'], ['returned', 'Returned', '#80585e'],
];
const findStatus = (counts, key) => Number(counts?.find((item) => item.status === key)?.n || 0);

export function AdminDashboard({ initial, emailAlerts }) {
  const [data, setData] = useState(initial);
  const [rangeChoice, setRangeChoice] = useState(String(initial.days || 30));
  const [dateFrom, setDateFrom] = useState(initial.from || '');
  const [dateTo, setDateTo] = useState(initial.to || '');
  const [requestKey, setRequestKey] = useState(`range=${initial.days || 30}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/notifications', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const result = await res.json();
        setNotifications(result.notifications || []);
      })
      .catch((cause) => { if (cause.name !== 'AbortError') setNotificationError('Notifications are temporarily unavailable.'); });
    return () => controller.abort();
  }, []);

  const load = useCallback(async (query, signal) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/stats?${query}`, { cache: 'no-store', signal });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `Statistics request failed (${res.status})`);
      setData(result);
      setDateFrom(result.from || '');
      setDateTo(result.to || '');
    } catch (cause) {
      if (cause.name !== 'AbortError') setError(cause.message || 'Could not load dashboard statistics.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(requestKey, controller.signal);
    return () => controller.abort();
  }, [requestKey, load]);

  async function dismissNotification(id) {
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not mark this notification reviewed.');
      setNotifications((rows) => rows.map((row) => row.id === id ? { ...row, is_read: true } : row));
      toast('Marked as reviewed');
    } catch (cause) { toast(cause.message || 'Could not update notification', 'error'); }
  }

  function selectPreset(days) {
    setRangeChoice(String(days));
    setRequestKey(`range=${days}`);
  }

  function applyCustomRange() {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setError('Choose a valid start date and end date.');
      return;
    }
    setRangeChoice('custom');
    setRequestKey(`from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`);
  }

  const t = data.totals || {};
  const series = data.series || [];
  const statusSegments = STATUS.map(([key, label, color]) => ({ label, value: findStatus(data.statusCounts, key), color })).filter((item) => item.value > 0);
  const statusTotal = statusSegments.reduce((sum, item) => sum + item.value, 0);
  const inventorySegments = [
    { label: 'Healthy stock', value: Number(t.healthyStock || 0), color: '#438453' },
    { label: 'Low stock', value: Number(t.lowStock || 0), color: '#c28b36' },
    { label: 'Out of stock', value: Number(t.outOfStock || 0), color: '#b44b42' },
  ].filter((item) => item.value > 0);

  return (
    <div className="dashboard" aria-busy={loading}>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Live order, catalog and visitor data from your store database.</p>
        </div>
        <div className="dashboard-toolbar">
          <div className="seg" aria-label="Dashboard date range">
            {[[7, '7 days'], [30, '30 days'], [90, '90 days']].map(([days, label]) => (
              <button type="button" key={days} data-on={rangeChoice === String(days) ? 'true' : 'false'} aria-pressed={rangeChoice === String(days)} onClick={() => selectPreset(days)}>{label}</button>
            ))}
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setRequestKey((key) => `${key}&refresh=${Date.now()}`)} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'dashboard-spin' : ''} /> Refresh
          </button>
          <Link href="/admin/products/new" className="btn btn-sm"><Plus size={13} /> New product</Link>
        </div>
      </div>

      <section className="dashboard-range panel" aria-label="Custom report dates">
        <div><strong>Report period</strong><span className="sub">{data.from} to {data.to} · previous-period comparison uses the same number of days</span></div>
        <div className="dashboard-date-fields">
          <label>From <input type="date" className="input" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label>Through <input type="date" className="input" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
          <button type="button" className="btn btn-outline btn-sm" data-on={rangeChoice === 'custom'} onClick={applyCustomRange} disabled={loading}>Apply dates</button>
        </div>
      </section>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notificationError && <div className="alert info" role="status">{notificationError}</div>}
      {emailAlerts?.failures > 0 && (
        <div className="alert error dashboard-alert">
          <AlertCircle size={15} /> {emailAlerts.failures} email{emailAlerts.failures === 1 ? '' : 's'} failed to send.
          <Link href="/admin/settings">Review SMTP settings</Link>
        </div>
      )}

      {notifications.some((item) => !item.is_read && item.type === 'delivery_not_received') && (
        <section className="delivery-admin-alert" aria-live="polite">
          <div><div className="eyebrow">Customer care · delivery alert</div><h3>Delivery issue reported</h3><p>Review the customer's order details and contact them to investigate.</p></div>
          <div className="delivery-admin-alert-list">
            {notifications.filter((item) => !item.is_read && item.type === 'delivery_not_received').map((item) => (
              <article key={item.id}>
                <div><strong>{item.details?.orderNumber}</strong> · {item.details?.customerName}</div>
                <small>{item.body}<br />Contact: {item.details?.email} · {item.details?.phone || 'No phone'}<br />Items: {(item.details?.products || []).map((product) => `${product.name} × ${product.qty}`).join(', ')}<br />Address: {[item.details?.address?.line1, item.details?.address?.line2, item.details?.address?.city, item.details?.address?.state, item.details?.address?.country].filter(Boolean).join(', ')}<br />Status: {item.details?.status}</small>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => dismissNotification(item.id)}>Mark reviewed</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="admin-grid kpi-grid dashboard-kpis">
        <Kpi label="Revenue · selected period" value={money(t.revenue)} delta={`${percent(t.revenueGrowth)} vs previous period`} icon={TrendingUp} note={`${money(t.revenueAll)} all time`} />
        <Kpi label="Orders · all time" value={compact(t.orders)} delta={`${compact(t.ordersPeriod)} in this period · ${percent(t.ordersGrowth)} vs prior`} icon={Package} href="/admin/orders" />
        <Kpi label="Customers · all time" value={compact(t.customers)} delta={`${compact(t.customersPeriod)} new · ${percent(t.customersGrowth)} vs prior`} icon={Users} href="/admin/customers" />
        <Kpi label="Visitor-days" value={compact(t.visitorDays)} delta={`${compact(t.pageViews)} page views · daily unique hashes`} icon={Eye} />
        <Kpi label="Active products" value={compact(t.products)} delta={`${t.lowStock || 0} low · ${t.outOfStock || 0} out of stock`} icon={Package} href="/admin/products" />
        <Kpi label="Average order value" value={money(t.aov)} delta={`${compact(t.revenueOrderCount)} non-cancelled orders`} icon={TrendingUp} />
        <Kpi label="Pending orders" value={compact(t.pendingOrders)} delta="Awaiting confirmation" icon={AlertCircle} href="/admin/orders?status=pending" />
        <Kpi label="Delivered · period" value={compact(t.deliveredOrders)} delta={`${t.completionRate || 0}% of orders placed in this period`} icon={Package} />
        <Kpi label="Cancelled / returned" value={`${compact(t.cancelledOrders)} / ${compact(t.returnedOrders)}`} delta="Selected period" icon={AlertCircle} />
      </div>

      <div className="admin-grid dashboard-grid dashboard-grid-primary">
        <section className="panel">
          <div className="panel-head">
            <div><h3>Revenue trend</h3><p className="sub">Daily revenue against the previous {data.days}-day period</p></div>
            <div className="dashboard-legend"><span><i data-kind="current" /> Current</span><span><i data-kind="compare" /> Previous</span></div>
          </div>
          {series.length ? <AreaChart data={series} yKey="revenue" compareKey="compareRevenue" height={230} format={money} ariaLabel="Revenue in the selected period compared with the previous period" /> : <EmptyChart message="No revenue data for this period." />}
          <div className="dashboard-chart-foot"><span>{data.from}</span><span>{money(t.revenue)} period revenue</span><span>{data.to}</span></div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>Order status</h3><p className="sub">Orders placed in the selected period</p></div><strong>{compact(statusTotal)}</strong></div>
          {statusSegments.length ? <div className="dashboard-donut-layout"><Donut segments={statusSegments} centerValue={compact(statusTotal)} centerLabel="orders" /><Legend items={statusSegments} /></div> : <EmptyChart message="No orders in this period." />}
        </section>
      </div>

      <div className="admin-grid dashboard-grid dashboard-grid-triple">
        <section className="panel"><div className="panel-head"><div><h3>Daily sales</h3><p className="sub">Order count by date</p></div></div>{series.some((item) => item.orders) ? <BarChart data={series.slice(-30)} yKey="orders" height={150} format={compact} ariaLabel="Daily order count" /> : <EmptyChart message="No orders recorded in this period." />}</section>
        <section className="panel"><div className="panel-head"><div><h3>Customer growth</h3><p className="sub">New accounts by date</p></div></div>{series.some((item) => item.customers) ? <BarChart data={series.slice(-30)} yKey="customers" height={150} format={compact} ariaLabel="New customer accounts by day" /> : <EmptyChart message="No new customer accounts in this period." />}</section>
        <section className="panel"><div className="panel-head"><div><h3>Visitor-days</h3><p className="sub">Daily distinct anonymous visitor hashes</p></div></div>{series.some((item) => item.visitorDays) ? <BarChart data={series.slice(-30)} yKey="visitorDays" height={150} format={compact} ariaLabel="Daily visitor-days" /> : <EmptyChart message="Visitor analytics are unavailable or no page views were recorded." />}</section>
      </div>

      <div className="admin-grid dashboard-grid dashboard-grid-secondary">
        <section className="panel">
          <div className="panel-head"><div><h3>Monthly revenue</h3><p className="sub">Monthly totals within the selected period</p></div></div>
          {data.monthlyRevenue?.length ? <BarChart data={data.monthlyRevenue} xKey="month" yKey="revenue" height={175} format={money} ariaLabel="Monthly revenue comparison" /> : <EmptyChart message="No monthly sales to compare yet." />}
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>Customer and stock health</h3><p className="sub">Database-backed rates; conversion is not inferred from visits</p></div></div>
          <div className="dashboard-rings">
            <RingMetric label="Customer growth" value={t.customersGrowth == null ? null : Math.max(0, Math.min(100, t.customersGrowth))} display={percent(t.customersGrowth)} color="#5479a5" detail="vs previous period" />
            <RingMetric label="Order completion" value={t.completionRate} color="#438453" detail="delivered / placed" />
            <RingMetric label="Delivery success" value={t.deliverySuccessRate} color="#39926a" detail="delivered / resolved" />
            <RingMetric label="Inventory health" value={t.inventoryHealth} color="#bd8733" detail="healthy active products" />
          </div>
          <p className="dashboard-footnote">Conversion rate is not shown: page views are not linked to orders or customer sessions in the current tracking schema.</p>
        </section>
      </div>

      <div className="admin-grid dashboard-grid dashboard-grid-secondary">
        <section className="panel">
          <div className="panel-head"><div><h3>Best-selling products</h3><p className="sub">Units and revenue in this period</p></div><Link href="/admin/products" className="sub">View catalog</Link></div>
          {(data.topProducts || []).length ? data.topProducts.map((product, index) => <HBar key={`${product.product_id}-${index}`} label={`${index + 1}. ${product.name}`} value={product.revenue} max={Math.max(...data.topProducts.map((item) => Number(item.revenue)), 1)} format={(value) => `${money(value)} · ${product.units} units`} />) : <EmptyChart message="No product sales in this period." />}
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>Category performance</h3><p className="sub">Revenue by category in this period</p></div></div>
          {(data.topCategories || []).length ? data.topCategories.map((category) => <HBar key={category.name} label={category.name} value={category.revenue} max={Math.max(...data.topCategories.map((item) => Number(item.revenue)), 1)} format={money} />) : <EmptyChart message="No category sales in this period." />}
        </section>
      </div>

      <div className="admin-grid dashboard-grid dashboard-grid-last">
        <section className="panel panel-table">
          <div className="panel-head"><div><h3>Recent orders</h3><p className="sub">Latest orders across all dates</p></div><Link href="/admin/orders" className="sub">All orders</Link></div>
          <div className="table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="align-right">Total</th></tr></thead><tbody>
            {(data.recentOrders || []).map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`} className="dashboard-order-link">{order.order_number}</Link><div className="sub">{new Date(order.placed_at).toLocaleDateString('en-GB')}</div></td><td>{order.customer_name || order.email}</td><td><StatusPill status={order.status} /></td><td className="align-right">{money(order.grand_total)}</td></tr>)}
            {!data.recentOrders?.length && <tr><td colSpan={4} className="empty-state">No orders yet.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>Inventory status</h3><p className="sub">Active products only</p></div></div>
          {inventorySegments.length ? <div className="dashboard-donut-layout"><Donut segments={inventorySegments} centerValue={compact(t.products)} centerLabel="products" /><Legend items={inventorySegments} /></div> : <EmptyChart message="No active products." />}
          <Link href="/admin/inventory" className="dashboard-attention"><AlertCircle size={15} /><span><strong>{compact(t.lowStock + t.outOfStock)} need attention</strong><small>Open inventory</small></span><ArrowUpRight size={14} /></Link>
          {(data.lowStockProducts || []).slice(0, 5).map((product) => <div className="dashboard-stock-row" key={product.id}><span>{product.name}</span><strong data-empty={product.stock === 0}>{product.stock} left</strong></div>)}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, icon: Icon, href, note }) {
  const content = <div className="kpi"><div className="kpi-topline"><small>{label}</small>{Icon && <Icon size={15} aria-hidden="true" />}</div><strong>{value}</strong><div className="delta">{delta}</div>{note && <div className="sub kpi-note">{note}</div>}</div>;
  return href ? <Link href={href} className="kpi-link">{content}</Link> : content;
}

function Legend({ items }) {
  return <ul className="dashboard-legend-list">{items.map((item) => <li key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{compact(item.value)}</strong></li>)}</ul>;
}

function RingMetric({ label, value, display, color, detail }) {
  const safeValue = value == null ? 0 : Math.max(0, Math.min(100, value));
  return <div className="dashboard-ring-metric"><ProgressRing value={safeValue} size={84} color={color} /><strong>{label}</strong><small>{value == null ? 'No prior-period baseline' : `${display || `${Math.round(safeValue)}%`} ${detail}`}</small></div>;
}

function EmptyChart({ message }) {
  return <div className="dashboard-empty" role="status">{message}</div>;
}
