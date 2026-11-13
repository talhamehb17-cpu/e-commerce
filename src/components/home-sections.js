'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useStore } from './providers';
import { Reveal, CountUp } from './reveal';
import { SectionHead, Stars } from './ui';
import { ShopGrid, QuickView } from './shop';
import { useCart } from './cart-drawer';
import { CartDrawer } from './cart-drawer';
import { NewsletterForm } from './newsletter';
import { ArrowRight, Instagram, Sparkles } from './icons';

/** Renders admin-managed homepage sections. Every type is data-driven. */
export function HomeSections({ sections, data }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [quick, setQuick] = useState(null);
  const cartState = useCart(() => setCartOpen(true));

  return (
    <>
      {sections.map((s, idx) => {
        const config = s.config || {};
        switch (s.type) {
          case 'hero':
            return <Hero key={s.id} section={s} config={config} />;
          case 'marquee':
            return <Marquee key={s.id} items={config.items || []} />;
          case 'categories':
            return <CategoryRow key={s.id} section={s} categories={data.categories} config={config} />;
          case 'products': {
            const source = config.source || 'featured';
            const products = data.products[source] || data.products.featured || [];
            return (
              <section key={s.id} className="section">
                <div className="wrap">
                  <Reveal>
                    <SectionHead eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle} action={s.cta_label} actionHref={s.cta_href} />
                  </Reveal>
                  <Reveal delay={80}>
                    <ShopGrid products={products.slice(0, config.limit || 8)} openCart={() => setCartOpen(true)} />
                  </Reveal>
                </div>
              </section>
            );
          }
          case 'banner':
            return <Banner key={s.id} section={s} />;
          case 'story':
            return <Story key={s.id} section={s} config={config} />;
          case 'values':
            return <Values key={s.id} section={s} items={config.items || []} />;
          case 'brands':
            return <Brands key={s.id} section={s} brands={data.brands} />;
          case 'collections':
            return <CollectionGrid key={s.id} section={s} collections={data.collections} />;
          case 'reviews':
            return <Reviews key={s.id} section={s} reviews={data.reviews} />;
          case 'instagram':
            return <Gallery key={s.id} section={s} products={data.products.bestsellers} />;
          case 'newsletter':
            return <Newsletter key={s.id} section={s} />;
          default:
            return null;
        }
      })}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cartState={cartState} />
      <QuickView product={quick} open={Boolean(quick)} onClose={() => setQuick(null)} openCart={() => setCartOpen(true)} />
    </>
  );
}

function Hero({ section, config }) {
  const stats = config.stats || [];
  return (
    <section className="hero">
      <div className="hero-glow a" />
      <div className="hero-glow b" />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <Reveal>
            <div className="eyebrow">{section.eyebrow}</div>
            <h1>
              {section.title?.split(' ').slice(0, -1).join(' ')}{' '}
              <em>{section.title?.split(' ').slice(-1)}</em>
            </h1>
            <p className="hero-lede">{section.subtitle}</p>
          </Reveal>
          <Reveal delay={120}>
            <div className="hero-cta">
              <Link className="btn" href={section.cta_href || '/shop'}>{section.cta_label || 'Shop all'} <ArrowRight size={15} /></Link>
              {config.secondary_cta && <Link className="btn btn-outline" href={config.secondary_href || '/about'}>{config.secondary_cta}</Link>}
            </div>
          </Reveal>
          {stats.length > 0 && (
            <Reveal delay={200}>
              <div className="hero-stats">
                {stats.map(([value, label]) => (
                  <div key={label}>
                    <span>{value}</span>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>
        <div className="hero-media">
          <Reveal delay={60} className="frame hero-main-frame">
            <Image src={section.image_url || '/images/hero/hero-main.jpg'} alt={section.title || 'Featured collection'} fill priority sizes="(max-width:980px) 90vw, 46vw" quality={82} style={{ objectFit: 'cover' }} />
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {config.secondary_image && (
              <Reveal delay={140} className="frame hero-side-frame">
                <Image src={config.secondary_image} alt="" fill sizes="(max-width:980px) 40vw, 20vw" quality={78} style={{ objectFit: 'cover' }} />
              </Reveal>
            )}
            <Reveal delay={220}>
              <div className="hero-float" style={{ position: 'static' }}>
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                <div>
                  <strong>48h</strong>
                  <small>Dispatch window</small>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marquee({ items }) {
  if (!items.length) return null;
  return (
    <div className="marquee">
      <div className="marquee-track">
        {[...items, ...items, ...items].map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </div>
  );
}

function CategoryRow({ section, categories, config }) {
  const list = (categories || []).slice(0, config.limit || 7);
  if (!list.length) return null;
  return (
    <section className="section">
      <div className="wrap">
        <Reveal>
          <SectionHead eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} action="All departments" actionHref="/shop" />
        </Reveal>
        <div className={`cat-grid ${list.length >= 7 ? 'cat-7' : ''}`}>
          {list.map((c, i) => (
            <Reveal key={c.slug} delay={i * 50}>
              <Link href={`/collections/${c.slug}`} className="cat-card">
                <Image src={c.image} alt={c.name} fill sizes="(max-width:720px) 50vw, 16vw" quality={72} style={{ objectFit: 'cover' }} />
                <small>{c.product_count} items</small>
                <span>{c.name} <i><ArrowRight size={13} /></i></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Banner({ section }) {
  const align = section.config?.align || 'left';
  return (
    <section className="section-tight">
      <div className="wrap">
        <Reveal>
          <div className="banner" data-align={align}>
            <Image src={section.image_url || '/images/hero/hero-main.jpg'} alt={section.title || ''} fill sizes="100vw" quality={78} style={{ objectFit: 'cover' }} />
            <div className="banner-inner">
              <div className="eyebrow">{section.eyebrow}</div>
              <h2>{section.title}</h2>
              <p>{section.subtitle}</p>
              {section.cta_label && <Link className="btn" href={section.cta_href || '/shop'}>{section.cta_label}</Link>}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Story({ section, config }) {
  return (
    <section className="section">
      <div className="wrap story-grid">
        <Reveal className="story-copy">
          <div className="eyebrow">{section.eyebrow}</div>
          <h2>{section.title}</h2>
          <p>{section.subtitle}</p>
          {section.cta_label && <Link className="btn btn-outline" href={section.cta_href || '/about'} style={{ marginTop: 26 }}>{section.cta_label}</Link>}
        </Reveal>
        <Reveal delay={100} className="story-media">
          <Image src={config.portrait || '/images/hero/hero-side.jpg'} alt="" width={640} height={800} sizes="(max-width:980px) 45vw, 24vw" quality={76} style={{ objectFit: 'cover' }} />
          <Image src={section.image_url || '/images/hero/hero-main.jpg'} alt="" width={640} height={800} sizes="(max-width:980px) 45vw, 24vw" quality={76} style={{ objectFit: 'cover' }} />
        </Reveal>
      </div>
    </section>
  );
}

function Values({ section, items }) {
  if (!items.length) return null;
  return (
    <section className="section-tight">
      <div className="wrap">
        <div className="values">
          {items.map(([big, small], i) => (
            <div className="value" key={i}>
              <strong>{big}</strong>
              <small>{small}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Brands({ section, brands }) {
  if (!brands?.length) return null;
  return (
    <section className="section-tight">
      <div className="wrap">
        <Reveal>
          <SectionHead eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} action="All brands" actionHref="/brands" />
        </Reveal>
        <Reveal delay={60}>
          <div className="brand-strip">
            {brands.slice(0, 7).map((b) => (
              <Link key={b.slug} href={`/brands/${b.slug}`}>
                <strong>{b.name}</strong>
                <small>{b.product_count} products</small>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CollectionGrid({ section, collections }) {
  if (!collections?.length) return null;
  return (
    <section className="section">
      <div className="wrap">
        <Reveal>
          <SectionHead eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} action="All collections" actionHref="/collections" />
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
          {collections.slice(0, 4).map((c, i) => (
            <Reveal key={c.slug} delay={i * 60}>
              <Link href={`/collections/${c.slug}`} className="cat-card" style={{ aspectRatio: '4/3' }}>
                <Image src={c.image} alt={c.name} fill sizes="(max-width:720px) 100vw, 25vw" quality={74} style={{ objectFit: 'cover' }} />
                <small>{c.product_count} products</small>
                <span>{c.name} <i><ArrowRight size={13} /></i></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reviews({ section, reviews }) {
  if (!reviews?.length) return null;
  return (
    <section className="section">
      <div className="wrap">
        <Reveal>
          <SectionHead eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} />
        </Reveal>
        <div className="review-grid">
          {reviews.map((r, i) => (
            <Reveal key={r.id} delay={i * 70}>
              <article className="review-card">
                <Stars rating={r.rating} />
                <blockquote>“{r.body}”</blockquote>
                <div className="review-who">
                  <span className="avatar">{(r.customer_name || 'N')[0]}</span>
                  <div>
                    <strong style={{ fontSize: 13 }}>{r.customer_name}</strong>
                    <small>{r.product_name}</small>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery({ section, products }) {
  const imgs = (products || []).slice(0, 6);
  const pool = imgs.length ? imgs.map((p) => p.image) : ['/images/hero/hero-main.jpg', '/images/hero/hero-side.jpg'];
  return (
    <section className="section-tight">
      <div className="wrap">
        <Reveal>
          <SectionHead eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} />
        </Reveal>
        <div className="ig-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <a key={i} href="https://instagram.com" target="_blank" rel="noreferrer">
              <Image src={pool[i % pool.length]} alt="" fill sizes="(max-width:720px) 33vw, 16vw" quality={62} style={{ objectFit: 'cover' }} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter({ section }) {
  return (
    <section className="section-tight">
      <div className="wrap">
        <Reveal>
          <div className="newsletter">
            <div>
              <div className="eyebrow">{section.eyebrow}</div>
              <h2>{section.title}</h2>
              <p>{section.subtitle}</p>
            </div>
            <div>
              <NewsletterForm />
              <p className="nl-note">One email a week. Unsubscribe in a click.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
