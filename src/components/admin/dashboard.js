'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusPill } from '../ui';
import { toast } from '../toast';
import { RefreshCw, ArrowUpRight, Plus, TrendingUp, Package, Users, Eye, AlertCircle } from '../icons';

const money = (minor) => `Rs ${(Number(minor || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
const percent = (n) => n == null ? '—' : `${n > 0 ? '+' : ''}${n}%`;


export function AdminDashboard({ initial, initialError = '', emailAlerts }) {
  const [data, setData] = useState(initial);
  const [rangeChoice, setRangeChoice] = useState(String(initial?.days || 30));
  const [dateFrom, setDateFrom] = useState(initial?.from || '');
  const [dateTo, setDateTo] = useState(initial?.to || '');
  const [requestKey, setRequestKey] = useState(`range=${initial?.days || 30}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
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
      const raw = await res.text();
      let result;
      try { result = raw ? JSON.parse(raw) : null; } catch { result = null; }
      if (!res.ok) throw new Error(result?.error || `Dashboard statistics request failed (HTTP ${res.status}).`);
      if (!result) throw new Error('Dashboard statistics returned an empty response.');
      if (!Array.isArray(result.monthlyRevenue)) {
        result.monthlyRevenue = [];
        result.monthlyRevenueError = 'The dashboard response did not include monthly revenue data.';
      }
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

  const t = data?.totals || {};

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
        <div><strong>Report period</strong><span className="sub">{data?`${data.from} to ${data.to} · previous-period comparison uses the same number of days`:'Statistics are not available until the data request succeeds.'}</span></div>
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
        <Kpi label="Paid gross revenue · selected period" value={data?money(t.revenue):'—'} delta={data?`${percent(t.revenueGrowth)} vs previous period · not refund-adjusted`:'Data unavailable'} icon={TrendingUp} />
        <Kpi label="Orders · all time" value={data?compact(t.orders):'—'} delta={data?`${compact(t.ordersPeriod)} placed in selected period`:'Data unavailable'} icon={Package} href="/admin/orders" />
        <Kpi label="Customers · all time" value={data?compact(t.customers):'—'} delta={data?`${compact(t.customersPeriod)} registrations in period`:'Data unavailable'} icon={Users} href="/admin/customers" />
        <Kpi label="Visitor-days" value={data?compact(t.visitorDays):'—'} delta={data?`${compact(t.pageViews)} page views · daily anonymous hashes`:'Data unavailable'} icon={Eye} />
      </div>
      <section className="panel dashboard-revenue-panel" aria-label="Monthly revenue graph">
        <div className="panel-head"><div><h3>Monthly revenue</h3><p className="sub">Paid gross order value grouped by order date · base-currency PKR · COD counts paid on delivery; cancelled/refunded orders excluded · not profit or refund-adjusted net revenue</p></div><span className="eyebrow">Last 12 months</span></div>
        <MonthlyRevenueGraph rows={data?.monthlyRevenue||[]} error={data?.monthlyRevenueError||error} loading={loading} onRetry={() => setRequestKey((key) => `${key}&refresh=${Date.now()}`)} />
      </section>
      <div className="admin-grid dashboard-grid dashboard-grid-last">
        <section className="panel panel-table">
          <div className="panel-head"><div><h3>Recent orders</h3><p className="sub">Latest order activity · amounts in base currency</p></div><Link href="/admin/orders" className="sub">All orders</Link></div>
          <div className="table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="align-right">Total</th></tr></thead><tbody>
            {(data?.recentOrders || []).map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.id}`} className="dashboard-order-link">{order.order_number}</Link><div className="sub">{new Date(order.placed_at).toLocaleString(undefined, { timeZone: data?.timezone || 'Asia/Karachi' })}</div></td><td>{order.customer_name || 'Guest'}</td><td><StatusPill status={order.status} /></td><td className="align-right">{money(order.grand_total)}</td></tr>)}
            {!data?.recentOrders?.length && <tr><td colSpan={4} className="empty-state">{data?'No orders yet.':'Recent orders are unavailable until dashboard data loads.'}</td></tr>}
          </tbody></table></div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>Needs attention</h3><p className="sub">Current open tasks, not historical analytics</p></div></div>
          <Link href="/admin/orders?status=pending" className="dashboard-attention"><Package size={15} /><span><strong>{data?`${compact(t.pendingOrders)} pending orders`:'Pending-order count unavailable'}</strong><small>Review order queue</small></span><ArrowUpRight size={14} /></Link>
          <Link href="/admin/inventory" className="dashboard-attention"><AlertCircle size={15} /><span><strong>{data?`${compact(t.lowStock + t.outOfStock)} low or out of stock`:'Inventory count unavailable'}</strong><small>Open inventory</small></span><ArrowUpRight size={14} /></Link>
          <Link href="/admin/analytics" className="btn" style={{marginTop:14,width:'100%',justifyContent:'center'}}><TrendingUp size={14}/> Open full Analytics Center <ArrowUpRight size={13}/></Link>
        </section>
      </div>
    </div>
  );
}

function MonthlyRevenueGraph({ rows = [], error = '', loading = false, onRetry }) {
  const [hovered, setHovered] = useState(null);
  const W=820,H=300,pad={left:78,right:22,top:20,bottom:55};
  const width=W-pad.left-pad.right,height=H-pad.top-pad.bottom;
  const maxValue=Math.max(0,...rows.map((row)=>Number(row.revenue)||0));
  const magnitude=maxValue>0?10**Math.floor(Math.log10(maxValue/5)):1;
  const step=Math.max(1,magnitude*Math.ceil(maxValue/5/magnitude));
  const max=step*5;
  const points=rows.map((row,index)=>({x:pad.left+(rows.length<2?width/2:width*index/(rows.length-1)),y:pad.top+height-(Number(row.revenue||0)/max)*height,row}));
  const moneyTick=(minor)=>`Rs ${new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(minor/100)}`;
  const labelIndexes=[...new Set([0,2,4,6,8,10,rows.length-1].filter((i)=>i>=0&&i<rows.length))];
  const selected=hovered==null?null:points[hovered];
  if(!rows.length)return <div className="dashboard-revenue-empty" role={error?'alert':'status'}>{error?<>Monthly revenue could not be loaded: {error} <button type="button" className="btn btn-outline btn-sm" onClick={onRetry} disabled={loading}>{loading?'Retrying…':'Retry revenue data'}</button></>:loading?'Loading monthly revenue…':'Monthly revenue history is unavailable.'}</div>;
  const hasRevenue = rows.some((row)=>Number(row.revenue)>0);
  return <div className="dashboard-revenue-chart-wrap">
    <svg className="dashboard-revenue-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly paid gross revenue line graph with month labels and PKR scale">
      {Array.from({length:6},(_,index)=>{const y=pad.top+height-height*index/5;return <g key={index}><line x1={pad.left} x2={W-pad.right} y1={y} y2={y} className="dashboard-revenue-gridline"/><text x={pad.left-10} y={y+4} textAnchor="end" className="dashboard-revenue-axis-label">{moneyTick(max*index/5)}</text></g>})}
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top+height} className="dashboard-revenue-axis"/>
      <line x1={pad.left} x2={W-pad.right} y1={pad.top+height} y2={pad.top+height} className="dashboard-revenue-axis"/>
      <polyline points={points.map(({x,y})=>`${x},${y}`).join(' ')} fill="none" className="dashboard-revenue-line"/>
      {points.map(({x,y,row},index)=><circle key={row.month} cx={x} cy={y} r="4" tabIndex={0} role="graphics-symbol" aria-label={`${row.month}: ${money(row.revenue)} paid gross revenue`} className="dashboard-revenue-point" onMouseEnter={()=>setHovered(index)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(index)} onBlur={()=>setHovered(null)} />)}
      {labelIndexes.map((index)=><g key={rows[index].month}><line x1={points[index].x} x2={points[index].x} y1={pad.top+height} y2={pad.top+height+5} className="dashboard-revenue-axis"/><text x={points[index].x} y={H-25} textAnchor="middle" className="dashboard-revenue-axis-label">{rows[index].label} ’{rows[index].month.slice(2,4)}</text></g>)}
    </svg>
    {!hasRevenue&&<p className="dashboard-revenue-zero" role="status">No paid revenue recorded in these 12 calendar months. The graph reflects paid orders only.</p>}
    {selected&&<div className="dashboard-revenue-tooltip" aria-live="polite"><small>{selected.row.month}</small><strong>{money(selected.row.revenue)}</strong><span>Paid gross revenue</span></div>}
  </div>;
}

function Kpi({ label, value, delta, icon: Icon, href, note }) {
  const content = <div className="kpi"><div className="kpi-topline"><small>{label}</small>{Icon && <Icon size={15} aria-hidden="true" />}</div><strong>{value}</strong><div className="delta">{delta}</div>{note && <div className="sub kpi-note">{note}</div>}</div>;
  return href ? <Link href={href} className="kpi-link">{content}</Link> : content;
}
