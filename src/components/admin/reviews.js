'use client';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Stars } from '../ui';
import { toast } from '../toast';
import { Check, X, Trash2, Star } from '../icons';

export function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/reviews?filter=${filter}`, { cache: 'no-store' });
    if (res.ok) setReviews((await res.json()).reviews);
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function patch(id, body) {
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { toast('Review updated'); load(); } else toast('Could not update', 'error');
  }

  async function remove(id) {
    if (!confirm('Delete this review permanently?')) return;
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted'); load(); }
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Reviews</h1><p>Moderate customer reviews. Unapproved reviews never appear on the storefront.</p></div>
      </div>

      <div className="tabs">
        {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved']].map(([k, label]) => (
          <button key={k} data-on={filter === k ? 'true' : 'false'} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {loading && <div className="panel">Loading reviews…</div>}
      {!loading && reviews.length === 0 && <div className="panel empty-state">No reviews in this view.</div>}

      <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        {reviews.map((r) => (
          <div className="panel" key={r.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div>
                <strong style={{ fontSize: 13 }}>{r.customer_name}</strong>
                <div className="sub" style={{ fontSize: 10.5 }}>{r.customer_email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Stars rating={r.rating} />
                {r.is_verified && <div className="sub" style={{ fontSize: 9.5 }}>Verified purchase</div>}
              </div>
            </div>
            {r.title && <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>{r.title}</div>}
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)' }}>{r.body}</p>
            {r.images?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {r.images.map((src) => <Image key={src} src={src} alt="" width={48} height={48} style={{ borderRadius: 6, objectFit: 'cover' }} />)}
              </div>
            )}
            <div className="sub" style={{ fontSize: 10.5, marginTop: 10 }}>
              {r.product_name} · {new Date(r.created_at).toLocaleDateString('en-GB')} · {r.is_approved ? 'published' : 'pending'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {!r.is_approved ? (
                <button className="chip" onClick={() => patch(r.id, { isApproved: true })}><Check size={11} /> Approve</button>
              ) : (
                <button className="chip" onClick={() => patch(r.id, { isApproved: false })}><X size={11} /> Unpublish</button>
              )}
              <button className="chip" onClick={() => patch(r.id, { isFeatured: !r.is_featured })} style={{ opacity: r.is_featured ? 1 : 0.7 }}>
                <Star size={11} fill={r.is_featured ? 'currentColor' : 'none'} /> {r.is_featured ? 'Featured' : 'Feature'}
              </button>
              <button className="chip" style={{ color: '#a2372c' }} onClick={() => remove(r.id)}><Trash2 size={11} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
