import Image from 'next/image';
import Link from 'next/link';
import { Breadcrumb } from '@/components/ui';

export const metadata = { title: 'Our story', description: 'Learn about NOVA and our considered approach to everyday essentials.', alternates: { canonical: '/about' } };

export default function AboutPage() {
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Our story' }]} />
          <h1>Chosen, not stocked</h1>
          <p className="muted" style={{ marginTop: 12, maxWidth: 620, fontSize: 15 }}>
            NOVA is a small buying team, not a marketplace. Every product is sampled in person, used for weeks, and only listed if it survives real life.
          </p>
        </div>
      </div>
      <div className="wrap section-tight">
        <div style={{ position: 'relative', aspectRatio: '21/9', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--surface2)' }}>
          <Image src="/images/hero/hero-main.jpg" alt="Our studio" fill sizes="100vw" priority style={{ objectFit: 'cover' }} />
        </div>
        <div className="narrow section-tight" style={{ paddingInline: 0 }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.85, color: 'var(--muted)' }}>
            We started in 2021 with a stubborn idea: that buying things online should not feel like a gamble. Most stores list thousands of products they have never held. We list a few hundred we have.
          </p>
          <p style={{ fontSize: 15.5, lineHeight: 1.85, color: 'var(--muted)', marginTop: 18 }}>
            That means we say no a lot. A headphone that sounds fine but creaks after a month does not make it. A coat with beautiful wool and a bad zip does not make it. What does make it stays for years, because we would rather sell you one thing you keep than three you replace.
          </p>
          <p style={{ fontSize: 15.5, lineHeight: 1.85, color: 'var(--muted)', marginTop: 18 }}>
            Every order is dispatched within 48 hours from our studio, with a 30-day return window and a two-year quality promise. If something fails, we repair or replace it — no argument.
          </p>
          <Link className="btn" href="/shop" style={{ marginTop: 28 }}>Shop the catalogue</Link>
        </div>
      </div>
    </>
  );
}
