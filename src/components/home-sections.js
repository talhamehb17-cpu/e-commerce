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

const HERO_LAYOUT_BY_STYLE={
  editorial:'split-right',luxury:'premium-dark',boutique:'split-left',heritage:'collage',minimal:'spacious',
  artisan:'product-focused',modern:'floating-panel',classic:'magazine',bold:'marketplace',atelier:'split-right',
  industrial:'full-bleed',neon:'floating-panel',organic:'split-left',dramatic:'premium-dark',glass:'floating-panel',
  mono:'spacious',scandi:'product-focused',soft:'collage',gradient:'marketplace',aurora:'full-bleed',earth:'magazine',utility:'marketplace',
};

function HeroCopy({section,config,stats=[]}) {
  return <div className="hero-copy">
    <Reveal><div className="eyebrow">{section.eyebrow}</div><h1>{section.title?.split(' ').slice(0,-1).join(' ')}{' '}<em>{section.title?.split(' ').slice(-1)}</em></h1><p className="hero-lede">{section.subtitle}</p></Reveal>
    <Reveal delay={120}><div className="hero-cta"><Link className="btn" href={section.cta_href||'/shop'}>{section.cta_label||'Shop all'} <ArrowRight size={15}/></Link>{config.secondary_cta&&<Link className="btn btn-outline" href={config.secondary_href||'/about'}>{config.secondary_cta}</Link>}</div></Reveal>
    {stats.length>0&&<Reveal delay={200}><div className="hero-stats">{stats.map(([value,label])=><div key={label}><span>{value}</span><small>{label}</small></div>)}</div></Reveal>}
  </div>;
}

function HeroImage({src,alt,className='hero-art-image',sizes='(max-width:980px) 100vw, 52vw',priority=false}) {
  return <Image className={className} src={src||'/images/hero/hero-main.jpg'} alt={alt||''} fill sizes={sizes} priority={priority} quality={82} style={{objectFit:'cover'}}/>;
}

function Hero({ section, config }) {
  const store=useStore();
  const themeSlug=store?.theme?.slug||'moonstone';
  const style=['editorial','luxury','boutique','heritage','minimal','artisan','modern','classic','bold','atelier','industrial','neon','organic','dramatic','glass','mono','scandi','soft','gradient','aurora','earth','utility'].includes(themeSlug)?themeSlug:'editorial';
  const layout=HERO_LAYOUT_BY_STYLE[style]||'split-right';
  const main=section.image_url||'/images/hero/hero-main.jpg';
  const secondary=config.secondary_image||'';
  const copy=<HeroCopy section={section} config={config} stats={config.stats||[]}/>;

  if(layout==='full-bleed'||layout==='premium-dark') return <section className={`hero hero-layout-${layout}`} data-hero-layout={layout}>
    <HeroImage src={main} alt={section.title||'Featured collection'} className="hero-background-image" sizes="100vw" priority/>
    <div className="hero-image-shade"/><div className="wrap hero-overlay-content">{copy}</div>
  </section>;

  if(layout==='split-left') return <section className="hero hero-layout-split-left" data-hero-layout={layout}><div className="wrap hero-split-shell"><div className="hero-media hero-media-left"><Reveal className="frame hero-main-frame"><HeroImage src={main} alt={section.title||'Featured collection'} priority/></Reveal>{secondary&&<Reveal delay={100} className="frame hero-side-frame"><HeroImage src={secondary} alt="" sizes="(max-width:980px) 45vw,20vw"/></Reveal>}</div>{copy}</div></section>;

  if(layout==='collage') return <section className="hero hero-layout-collage" data-hero-layout={layout}><div className="wrap hero-collage-shell">{copy}<div className="hero-collage-media"><Reveal className="hero-collage-main"><HeroImage src={main} alt={section.title||'Featured collection'} priority/></Reveal>{secondary&&<Reveal delay={120} className="hero-collage-secondary"><HeroImage src={secondary} alt="" sizes="(max-width:980px) 45vw,24vw"/></Reveal>}<span className="hero-collage-caption">{section.eyebrow||'NOVA · THE EDIT'}</span></div></div></section>;

  if(layout==='spacious') return <section className="hero hero-layout-spacious" data-hero-layout={layout}><div className="wrap hero-spacious-shell">{copy}<Reveal className="hero-spacious-image"><HeroImage src={main} alt={section.title||'Featured collection'} sizes="(max-width:980px) 100vw,80vw" priority/></Reveal></div></section>;

  if(layout==='product-focused') return <section className="hero hero-layout-product-focused" data-hero-layout={layout}><div className="wrap hero-product-shell">{copy}<div className="hero-product-stage"><Reveal className="hero-product-image"><HeroImage src={main} alt={section.title||'Featured collection'} priority/></Reveal>{secondary&&<Reveal delay={120} className="hero-product-support"><HeroImage src={secondary} alt="" sizes="(max-width:980px) 35vw,18vw"/></Reveal>}<div className="hero-product-label"><Sparkles size={16}/><span>Selected for you</span></div></div></div></section>;

  if(layout==='floating-panel') return <section className="hero hero-layout-floating" data-hero-layout={layout}><HeroImage src={main} alt={section.title||'Featured collection'} className="hero-background-image" sizes="100vw" priority/><div className="hero-image-shade"/><div className="wrap hero-floating-shell"><div className="hero-floating-panel">{copy}</div></div></section>;

  if(layout==='magazine') return <section className="hero hero-layout-magazine" data-hero-layout={layout}><div className="wrap hero-magazine-shell"><div className="hero-magazine-kicker">NOVA / {section.eyebrow||'THE CONSIDERED EDIT'}</div>{copy}<Reveal className="hero-magazine-image"><HeroImage src={main} alt={section.title||'Featured collection'} priority/></Reveal>{secondary&&<Reveal className="hero-magazine-inset"><HeroImage src={secondary} alt="" sizes="(max-width:980px) 40vw,20vw"/></Reveal>}</div></section>;

  if(layout==='marketplace') return <section className="hero hero-layout-marketplace" data-hero-layout={layout}><div className="wrap hero-marketplace-shell">{copy}<Reveal className="hero-marketplace-image"><HeroImage src={main} alt={section.title||'Featured collection'} priority/><span className="hero-marketplace-label">NOVA PICKS · SHOP THE EDIT</span></Reveal></div></section>;

  // Editorial and atelier use a distinct text-left/image-right split composition.
  return <section className="hero hero-layout-split-right" data-hero-layout="split-right"><div className="hero-glow a"/><div className="hero-glow b"/><div className="wrap hero-grid">{copy}<div className="hero-media"><Reveal delay={60} className="frame hero-main-frame"><HeroImage src={main} alt={section.title||'Featured collection'} priority/></Reveal><div className="hero-side-stack">{secondary&&<Reveal delay={140} className="frame hero-side-frame"><HeroImage src={secondary} alt="" sizes="(max-width:980px) 40vw,20vw"/></Reveal>}<div className="hero-float"><Sparkles size={18} style={{color:'var(--accent)'}}/><div><strong>48h</strong><small>Dispatch window</small></div></div></div></div></div></section>;
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
            <Image className="banner-desktop-image" src={section.image_url || '/images/hero/hero-main.jpg'} alt={section.title || ''} fill sizes="100vw" quality={78} style={{ objectFit: 'cover' }} />
            {section.config?.mobile_image && <Image className="banner-mobile-image" src={section.config.mobile_image} alt="" fill sizes="100vw" quality={78} style={{ objectFit: 'cover' }} />}
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
                  {r.avatar_url ? <Image className="avatar" src={r.avatar_url} alt="" width={34} height={34} /> : <span className="avatar">{(r.customer_name || 'N')[0]}</span>}
                  <div>
                    <strong style={{ fontSize: 13 }}>{r.customer_name}</strong>
                    <Link href={`/products/${r.product_slug}`} className="home-review-product"><Image src={r.product_image || '/images/hero/hero-main.jpg'} alt="" width={34} height={42} /><small>{r.product_name}</small></Link>
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
