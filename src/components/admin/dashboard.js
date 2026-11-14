'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusPill } from '../ui';
import { toast } from '../toast';
import { RefreshCw, ArrowUpRight, Plus, TrendingUp, Package, Users, Eye, AlertCircle } from '../icons';

const money = (minor) => `Rs ${(Number(minor || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
const percent = (n) => n == null ? '—' : `${n > 0 ? '+' : ''}${n}%`;


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
          <Link href="/admin/analytics" className="btn btn-outline btn-sm">Full analytics <ArrowUpRight size={13} /></Link>
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
        <Kpi label="Paid gross revenue · selected period" value={money(t.revenue)} delta={`${percent(t.revenueGrowth)} vs previous period · not refund-adjusted`} icon={TrendingUp} />
        <Kpi label="Orders · all time" value={compact(t.orders)} delta={`${compact(t.ordersPeriod)} placed in selected period`} icon={Package} href="/admin/orders" />
        <Kpi label="Customers · all time" value={compact(t.customers)} delta={`${compact(t.customersPeriod)} registrations in period`} icon={Users} href="/admin/customers" />
        <Kpi label="Visitor-days" value={compact(t.visitorDays)} delta={`${compact(t.pageViews)} page views · daily anonymous hashes`} icon={Eye} />
      </div>
      <div className="admin-grid dashboard-grid dashboard-grid-last">
        <section className="panel panel-table">
          <div className="panel-head"><div><h3>Recent orders</h3><p className="sub">Latest order activity · amounts in base currency</p></div><Link href="/admin/orders" className="sub">All orders</Link></div>
          <div className="table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="align-right">Total</th></tr></thead><tbody>
            {(data.recentOrders || []).map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`} className="dashboard-order-link">{order.order_number}</Link><div className="sub">{new Date(order.placed_at).toLocaleString(undefined, { timeZone: data.timezone || 'Asia/Karachi' })}</div></td><td>{order.customer_name || 'Guest'}</td><td><StatusPill status={order.status} /></td><td className="align-right">{money(order.grand_total)}</td></tr>)}
            {!data.recentOrders?.length && <tr><td colSpan={4} className="empty-state">No orders yet.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>Needs attention</h3><p className="sub">Current open tasks, not historical analytics</p></div></div>
          <Link href="/admin/orders?status=pending" className="dashboard-attention"><Package size={15} /><span><strong>{compact(t.pendingOrders)} pending orders</strong><small>Review order queue</small></span><ArrowUpRight size={14} /></Link>
          <Link href="/admin/inventory" className="dashboard-attention"><AlertCircle size={15} /><span><strong>{compact(t.lowStock + t.outOfStock)} low or out of stock</strong><small>Open inventory</small></span><ArrowUpRight size={14} /></Link>
          <Link href="/admin/analytics" className="btn" style={{marginTop:14,width:'100%',justifyContent:'center'}}><TrendingUp size={14}/> Open full Analytics Center <ArrowUpRight size={13}/></Link>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, icon: Icon, href, note }) {
  const content = <div className="kpi"><div className="kpi-topline"><small>{label}</small>{Icon && <Icon size={15} aria-hidden="true" />}</div><strong>{value}</strong><div className="delta">{delta}</div>{note && <div className="sub kpi-note">{note}</div>}</div>;
  return href ? <Link href={href} className="kpi-link">{content}</Link> : content;
}
