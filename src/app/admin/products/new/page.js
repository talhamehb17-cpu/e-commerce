import { redirect } from 'next/navigation';
export default function NewProductPage() { redirect('/admin/products?new=1'); }
