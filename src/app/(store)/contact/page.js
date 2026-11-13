import { Breadcrumb } from '@/components/ui';
import { ContactForm } from '@/components/contact-form';
import { getSetting } from '@/lib/settings';
import { Mail, Phone, MapPin } from '@/components/icons';

export const metadata = { title: 'Contact us' };

export default async function ContactPage() {
  const store = await getSetting('store');
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />
          <h1>Talk to us</h1>
          <p className="muted" style={{ marginTop: 10 }}>A human replies within one business day.</p>
        </div>
      </div>
      <div className="wrap section-tight" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 32 }}>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}><Mail size={15} /> <strong style={{ fontSize: 13 }}>Email</strong></div>
            <a href={`mailto:${store.email}`} className="muted" style={{ fontSize: 13.5 }}>{store.email}</a>
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}><Phone size={15} /> <strong style={{ fontSize: 13 }}>Phone</strong></div>
            <span className="muted" style={{ fontSize: 13.5 }}>{store.phone}</span>
          </div>
          <div className="card">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}><MapPin size={15} /> <strong style={{ fontSize: 13 }}>Studio</strong></div>
            <span className="muted" style={{ fontSize: 13.5 }}>{store.address}</span>
          </div>
        </div>
        <div className="card"><ContactForm /></div>
      </div>
    </>
  );
}
