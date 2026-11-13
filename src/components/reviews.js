'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Stars } from './ui';
import { toast } from './toast';
import { useRouter } from 'next/navigation';
import { Star, Upload, X, CheckCircle2, BadgeCheck } from './icons';

export function ReviewSection({ product, customer, myReview, verifiedPurchase }) {
  const router = useRouter();
  const [reviews, setReviews] = useState(product.reviews);
  const [sort, setSort] = useState('recent');
  const [filter, setFilter] = useState(0);
  const [writing, setWriting] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  async function reload(nextSort = sort, nextFilter = filter) {
    const res = await fetch(`/api/reviews?productId=${product.id}&sort=${nextSort}&rating=${nextFilter}`);
    const data = await res.json();
    setReviews(data);
  }

  const avg = reviews.average;
  const total = reviews.total;
  const max = Math.max(1, ...reviews.distribution.map((d) => d.count));

  return (
    <section id="reviews">
      <div className="section-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Reviews</div>
          <h2 style={{ fontSize: 'clamp(24px,2.6vw,36px)' }}>What buyers say</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {customer ? (
            <button className="btn btn-outline btn-sm" onClick={() => setWriting(true)}>
              {myReview ? 'Edit your review' : 'Write a review'}
            </button>
          ) : (
            <Link className="btn btn-outline btn-sm" href={`/login?next=/products/${product.slug}`}>Sign in to review</Link>
          )}
        </div>
      </div>

      <div className="reviews-head">
        <div>
          <div className="rating-big">{avg ? avg.toFixed(1) : '—'}</div>
          <Stars rating={avg} size={15} />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{total} verified {total === 1 ? 'review' : 'reviews'}</div>
        </div>
        <div>
          {reviews.distribution.map((d) => (
            <div className="dist-row" key={d.rating}>
              <span style={{ width: 34 }}>{d.rating} star</span>
              <div className="dist-bar"><i style={{ width: `${total ? (d.count / total) * 100 : 0}%` }} /></div>
              <span style={{ width: 26, textAlign: 'right' }}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <select className="input" style={{ width: 'auto', padding: '8px 12px', fontSize: 12.5 }} value={sort} onChange={(e) => { setSort(e.target.value); reload(e.target.value, filter); }}>
          <option value="recent">Most recent</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
          <option value="helpful">Most helpful</option>
        </select>
        {[0, 5, 4, 3, 2, 1].map((r) => (
          <button key={r} className="chip" data-on={filter === r ? 'true' : 'false'} onClick={() => { setFilter(r); reload(sort, r); }}>
            {r === 0 ? 'All stars' : `${r} star`}
          </button>
        ))}
      </div>

      {reviews.items.length === 0 && (
        <p className="muted" style={{ padding: '26px 0', fontSize: 13.5 }}>
          No reviews yet. {customer ? 'Be the first to review this product.' : 'Sign in to leave the first review.'}
        </p>
      )}

      {reviews.items.map((r) => (
        <article className="review-item" key={r.id}>
          <div className="review-item-head">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="avatar">{(r.customer_name || 'N')[0]}</span>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13.5 }}>{r.customer_name}</strong>
                  {r.is_verified && <span className="verified"><BadgeCheck size={11} /> Verified purchase</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <Stars rating={r.rating} />
                  <span className="muted" style={{ fontSize: 11 }}>
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            <HelpfulButton review={r} onDone={reload} />
          </div>
          {r.title && <h4>{r.title}</h4>}
          <p>{r.body}</p>
          {r.images?.length > 0 && (
            <div className="review-images">
              {r.images.map((src) => (
                <Image key={src} src={src} alt="Customer photo" width={84} height={84} onClick={() => setLightbox(src)} style={{ cursor: 'zoom-in' }} />
              ))}
            </div>
          )}
        </article>
      ))}

      {writing && (
        <ReviewForm
          product={product}
          existing={myReview}
          verifiedPurchase={verifiedPurchase}
          onClose={() => setWriting(false)}
          onSaved={() => { setWriting(false); reload(); router.refresh(); }}
        />
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <Image src={lightbox} alt="Customer photo" width={1000} height={1000} style={{ maxHeight: '88vh', width: 'auto' }} />
        </div>
      )}
    </section>
  );
}

function HelpfulButton({ review, onDone }) {
  const [count, setCount] = useState(review.helpful_count || 0);
  const [on, setOn] = useState(false);
  async function click() {
    const res = await fetch('/api/reviews/helpful', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId: review.id }) });
    if (res.status === 401) { toast('Sign in to vote', 'error'); return; }
    const data = await res.json();
    setCount(data.count);
    setOn(data.helpful);
  }
  return (
    <button onClick={click} className="chip" style={{ fontSize: 11, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      <CheckCircle2 size={12} /> Helpful{count ? ` (${count})` : ''}
    </button>
  );
}

function ReviewForm({ product, existing, verifiedPurchase, onClose, onSaved }) {
  const [rating, setRating] = useState(existing?.rating || 5);
  const [title, setTitle] = useState(existing?.title || '');
  const [body, setBody] = useState(existing?.body || '');
  const [images, setImages] = useState(existing?.images || []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(file) {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { toast(data.error || 'Upload failed', 'error'); return; }
    setImages((s) => [...s, data.url].slice(0, 4));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, rating, title, body, images }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { toast(data.error || 'Could not save review', 'error'); return; }
    toast(existing ? 'Review updated' : 'Review published');
    onSaved();
  }

  return (
    <div className="modal" data-open="true" role="dialog" aria-label="Write a review">
      <div className="modal-scrim" onClick={onClose} />
      <div className="modal-panel" style={{ width: 'min(560px,100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="eyebrow">{existing ? 'Update review' : 'New review'}</div>
            <h3 style={{ fontSize: 21, marginTop: 2 }}>{product.name}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 22 }}>
          <div className="field">
            <label>Your rating</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`} style={{ padding: 2 }}>
                  <Star size={26} fill={n <= rating ? 'var(--accent)' : 'none'} color={n <= rating ? 'var(--accent)' : 'var(--line)'} strokeWidth={1.4} />
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="rt">Title (optional)</label>
            <input id="rt" className="input" maxLength={90} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sums it up in a few words" />
          </div>
          <div className="field">
            <label htmlFor="rb">Your review</label>
            <textarea id="rb" className="input" required minLength={12} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you like or dislike? How does it feel in use?" />
          </div>
          <div className="field">
            <label>Photos (up to 4)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {images.map((src) => (
                <div key={src} style={{ position: 'relative' }}>
                  <Image src={src} alt="" width={64} height={64} style={{ borderRadius: 8, objectFit: 'cover' }} />
                  <button type="button" onClick={() => setImages((s) => s.filter((i) => i !== src))} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--ink)', color: 'var(--bg)', borderRadius: '50%', width: 18, height: 18, display: 'grid', placeItems: 'center' }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              {images.length < 4 && (
                <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                  {uploading ? 'Uploading…' : <><Upload size={13} /> Add photo</>}
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>
          {verifiedPurchase
            ? <div className="notice" style={{ fontSize: 11.5, marginBottom: 14 }}><BadgeCheck size={13} /> This review will be marked “Verified purchase”.</div>
            : <div className="notice" style={{ fontSize: 11.5, marginBottom: 14 }}>Reviews are only marked verified when a matching order exists on your account.</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button className="btn" disabled={busy} style={{ flex: 1 }}>{busy ? 'Saving…' : existing ? 'Update review' : 'Publish review'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
