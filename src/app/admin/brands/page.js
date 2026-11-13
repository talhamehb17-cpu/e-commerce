import { AdminTaxonomy } from '@/components/admin/taxonomy';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brands' };
export default function BrandsPage() { return <AdminTaxonomy kind="brands" />; }
