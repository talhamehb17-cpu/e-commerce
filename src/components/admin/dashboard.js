'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AreaChart, BarChart, Donut, ProgressRing, HBar } from '../charts';
import { StatusPill } from '../ui';
import { RefreshCw, ArrowUpRight, Plus, TrendingUp, Package, Users, Eye, AlertCircle } from '../icons';

const money = (minor) => `Rs ${(Number(minor) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);

export function AdminDashboard({ initial, emailAlerts }) {
  const [range, setRange] = useState(30);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?range=${r}`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (range !== data.range) load(range); }, [range]); // eslint-disable-line

  const t = data.totals;
  const series = data.series || [];
  const statusSegments = [
    { label: 'Pending', value: findStatus(data.statusCounts, 'pending'), color: '#c9a227' },
    { label: 'Processing', value: findStatus(data.statusCounts, 'processing') + findStatus(data.statusCounts, 'confirmed') + findStatus(data.statusCounts, 'packed'), color: '#3b6ea5' },
    { label: 'Shipped', value: findStatus(data.statusCounts, 'shipped') + findStatus(data.statusCounts, 'out_for_delivery'), color: '#6b5bb5' },
    { label: 'Delivered', value: findStatus(data.statusCounts, 'delivered'), color: '#3f8a56' },
    { label: 'Cancelled', value: findStatus(data.statusCounts, 'cancelled') + findStatus(data.statusCounts, 'returned'), color: '#b4453a' },
  ].filter((s) => s.value > 0);

  const totalOrders = statusSegments.reduce((s, x) => s + x.value, 0);
  const maxCat = Math.max(...(data.topCategories || []).map((c) => Number(c.revenue)), 1);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Live figures from your database — nothing here is demo data.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="seg">
            {[[7, '7d'], [30, '30d'], [90, '90d'], [365, '1y']].map(([v, label]) => (
              <button key={v} data-on={range === v ? 'true' : 'false'} onClick={() => setRange(v)}>{label}</button>
            ))}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => load(range)} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin .8s linear infinite' : 'none' }} /> Refresh
          </button>
          <Link href="/admin/products/new" className="btn btn-sm"><Plus size={13} /> New product</Link>
        </div>
      </div>

      {emailAlerts?.failures > 0 && (
        <div className="alert error" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertCircle size={15} />
          {emailAlerts.failures} email{emailAlerts.failures > 1 ? 's' : ''} failed to send. Check your SMTP settings.
          <Link href="/admin/settings" style={{ marginLeft: 'auto', textDecoration: 'underline' }}>Review</Link>
        </div>
      )}

      <div className="admin-grid kpi-grid" style={{ marginBottom: 14 }}>
        <Kpi label="Revenue" value={money(t.revenue)} delta={`${range}d window`} icon={TrendingUp} note={`${money(t.revenueAll)} all time`} />
        <Kpi label="Orders" value={compact(t.orders)} delta={`${t.ordersRange} in ${range}d`} icon={Package} href="/admin/orders" />
        <Kpi label="Customers" value={compact(t.customers)} delta={`+${t.customersRange} in ${range}d`} icon={Users} href="/admin/customers" />
        <Kpi label="Visitors" value={compact(t.visitors)} delta={`${compact(t.views)} page views`} icon={Eye} />
        <Kpi label="Avg. order value" value={money(t.aov)} delta={`${t.conversion}% conversion`} icon={TrendingUp} />
        <Kpi label="Low stock" value={String(t.lowStock)} delta={`${t.outOfStock} out of stock`} icon={AlertCircle} href="/admin/inventory" tone={t.lowStock > 0 ? 'warn' : ''} />
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1.6fr .9fr', marginBottom: 14 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Revenue</h3>
              <div className="sub">Daily settled revenue · last {range} days</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>{money(t.revenue)}</div>
              <div className="sub">{range}-day total</div>
            </div>
          </div>
          <AreaChart data={series} yKey="revenue" height={230} format={money} />
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Order status</h3><span className="sub">{totalOrders} total</span></div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <Donut segments={statusSegments.length ? statusSegments : [{ label: 'No orders', value: 1, color: 'var(--surface2)' }]} centerValue={String(totalOrders)} centerLabel="orders" />
            <div style={{ flex: 1, minWidth: 120 }}>
              {statusSegments.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, marginBottom: 7 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <strong>{s.value}</strong>
                </div>
              ))}
              {!statusSegments.length && <p className="sub">No orders yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 14 }}>
        <div className="panel">
          <div className="panel-head"><h3>Orders per day</h3></div>
          <BarChart data={series.slice(-30)} yKey="orders" height={150} />
        </div>
        <div className="panel">
          <div className="panel-head"><h3>New customers</h3></div>
          <BarChart data={series.slice(-30)} yKey="customers" height={150} />
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Visitors</h3></div>
          <BarChart data={series.slice(-30)} yKey="visitors" height={150} />
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1.2fr 1fr', marginBottom: 14 }}>
        <div className="panel">
          <div className="panel-head">
            <h3>Top products</h3>
            <Link href="/admin/products" className="sub">View all</Link>
          </div>
          {(data.topProducts || []).length === 0 && <p className="sub">No sales recorded yet.</p>}
          {(data.topProducts || []).map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < data.topProducts.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontSize: 10.5, color: 'var(--muted)', width: 14 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12.5 }}>{p.name}</span>
              <span className="sub" style={{ fontSize: 11 }}>{p.units} sold</span>
              <strong style={{ fontSize: 12 }}>{money(p.revenue)}</strong>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Revenue by category</h3></div>
          {(data.topCategories || []).length === 0 && <p className="sub">No category sales yet.</p>}
          {(data.topCategories || []).map((c) => (
            <HBar key={c.name} label={c.name || 'Uncategorised'} value={Number(c.revenue)} max={maxCat} format={money} />
          ))}
          <div style={{ display: 'flex', gap: 18, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <ProgressRing value={t.conversion} size={86} label="conv." />
            </div>
            <div style={{ textAlign: 'center' }}>
              <ProgressRing value={t.returningRate} size={86} label="repeat" color="#3f8a56" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <ProgressRing value={t.products ? Math.min(100, (t.lowStock / Math.max(1, t.products)) * 100) : 0} size={86} label="low stk" color="#b4453a" />
            </div>
          </div>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1.4fr .9fr' }}>
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-head" style={{ padding: '16px 18px 10px' }}>
            <h3>Recent orders</h3>
            <Link href="/admin/orders" className="sub">All orders</Link>
          </div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {(data.recentOrders || []).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 600 }}>{o.order_number}</Link>
                      <div className="sub" style={{ fontSize: 10.5 }}>{new Date(o.placed_at).toLocaleDateString('en-GB')}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{o.customer_name || o.email}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(o.grand_total)}</td>
                  </tr>
                ))}
                {!data.recentOrders?.length && <tr><td colSpan={4} className="empty-state">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Needs attention</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/admin/inventory" className="drag-item" style={{ textDecoration: 'none' }}>
              <AlertCircle size={15} style={{ color: '#b4453a' }} />
              <div style={{ flex: 1 }}><strong>Low stock</strong><small>{t.lowStock} products at or below threshold</small></div>
              <ArrowUpRight size={13} />
            </Link>
            <Link href="/admin/reviews" className="drag-item" style={{ textDecoration: 'none' }}>
              <Users size={15} style={{ color: '#c9a227' }} />
              <div style={{ flex: 1 }}><strong>Reviews to moderate</strong><small>{t.reviewsPending} awaiting approval</small></div>
              <ArrowUpRight size={13} />
            </Link>
            <Link href="/admin/orders?status=pending" className="drag-item" style={{ textDecoration: 'none' }}>
              <Package size={15} style={{ color: 'var(--accent)' }} />
              <div style={{ flex: 1 }}><strong>Unfulfilled orders</strong><small>{findStatus(data.statusCounts, 'pending')} pending</small></div>
              <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="panel-head" style={{ marginTop: 18 }}><h3 style={{ fontSize: 16 }}>Low stock</h3></div>
          {(data.lowStockProducts || []).length === 0 && <p className="sub">Everything is stocked.</p>}
          {(data.lowStockProducts || []).map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0' }}>
              <span>{p.name}</span>
              <strong style={{ color: p.stock === 0 ? '#b4453a' : 'var(--accent)' }}>{p.stock} left</strong>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Kpi({ label, value, delta, icon: Icon, href, note, tone }) {
  const body = (
    <div className="kpi" style={tone === 'warn' ? { borderColor: 'color-mix(in srgb,#b4453a 40%,var(--line))' } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <small>{label}</small>
        {Icon && <Icon size={14} style={{ opacity: 0.4 }} />}
      </div>
      <strong>{value}</strong>
      <div className="delta">{delta}</div>
      {note && <div className="sub" style={{ fontSize: 10.5 }}>{note}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function findStatus(counts, status) {
  return counts?.find((c) => c.status === status)?.n || 0;
}
