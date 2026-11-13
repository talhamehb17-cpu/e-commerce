import { notFound } from 'next/navigation';
import { getSetting } from '@/lib/settings';
import { Breadcrumb } from '@/components/ui';

export const dynamic = 'force-static';

const POLICIES = {
  shipping: { title: 'Shipping', body: (s) => `We dispatch every order within 48 hours from our studio in Lahore.\n\nStandard delivery takes ${s.delivery_days} and costs Rs ${(s.flat_rate / 100).toLocaleString()}. Express delivery is Rs ${(s.express_rate / 100).toLocaleString()} and typically arrives in 1–2 business days.\n\nDelivery is free on orders over Rs ${(s.free_threshold / 100).toLocaleString()}.\n\nEvery parcel is tracked. You will receive a tracking number by email the moment your order is handed to the courier, and you can follow status changes on your order page.` },
  returns: { title: 'Returns & refunds', body: (s) => `You have ${s.return_window_days} days from delivery to return unused items in their original packaging.\n\nStart a return from your order page or email us. Once we receive the item we inspect it and refund within 5 business days to the original payment method. Cash-on-delivery orders are refunded by bank transfer or Easypaisa.\n\nItems that are damaged or faulty on arrival are replaced or refunded in full — we cover return shipping in Pakistan.` },
  privacy: { title: 'Privacy policy', body: () => `We collect only what we need to fulfil your order: your name, contact details, delivery address and order history.\n\nWe never sell your data. Payment details are never stored on our servers. Email is used for order updates and, if you opt in, one weekly newsletter you can unsubscribe from in a click.\n\nYou can request a copy of your data or ask us to delete your account at any time by emailing us.` },
  terms: { title: 'Terms of service', body: () => `By placing an order you agree to these terms.\n\nPrices are shown in your selected display currency but settled in PKR. Currency conversions are indicative and may vary slightly with your bank.\n\nProduct photography is representative; small variations in colour and finish are normal.\n\nWe reserve the right to cancel an order if an item is mispriced or out of stock, and will refund in full if we do.` },
  faq: { title: 'FAQ', body: () => `How long does delivery take?\nStandard delivery is 3–5 business days; express is 1–2.\n\nCan I change my order?\nYou can change an order until it ships. Email us with your order number.\n\nDo you ship internationally?\nYes. International shipping is calculated at checkout.\n\nHow do I know my size?\nEach product page lists measurements. When between sizes, we recommend sizing up.\n\nIs cash on delivery available?\nYes, across Pakistan.\n\nHow do I track my order?\nOpen your order page from the account area — the timeline updates as the status changes.` },
};

export async function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const title = POLICIES[slug]?.title || 'Policy';
  return { title, description: `${title} information for NOVA customers.`, alternates: { canonical: `/policies/${encodeURIComponent(slug)}` } };
}

export default async function PolicyPage({ params }) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();
  const shipping = await getSetting('shipping');
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: policy.title }]} />
          <h1>{policy.title}</h1>
        </div>
      </div>
      <div className="wrap narrow section-tight">
        <div style={{ whiteSpace: 'pre-line', fontSize: 14.5, lineHeight: 1.85, color: 'var(--muted)' }}>{policy.body(shipping)}</div>
      </div>
    </>
  );
}
