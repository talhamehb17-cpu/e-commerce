import { AdminTaxonomy } from '@/components/admin/taxonomy';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categories' };
export default function CategoriesPage() { return <AdminTaxonomy kind="categories" />; }
