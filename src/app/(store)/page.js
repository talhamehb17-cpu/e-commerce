import Image from 'next/image';
import Link from 'next/link';
import { getHomepageSections, listProducts, getCategories, getCollections, getBrands, getFeaturedReviews } from '@/lib/catalog';
import { HomeSections } from '@/components/home-sections';

export const revalidate = 30;

export const metadata = {
  title: 'NOVA — Everything, considered.',
  alternates: { canonical: '/' },
  description: 'One considered store for electronics, wardrobe, home, beauty, sport and everyday carry.',
};

export default async function HomePage() {
  const [sections, categories, collections, brands, reviews] = await Promise.all([
    getHomepageSections(),
    getCategories(),
    getCollections(),
    getBrands(),
    getFeaturedReviews(3),
  ]);

  const needProducts = sections.some((s) => s.type === 'products');
  const [featured, newest, bestsellers] = await Promise.all([
    needProducts ? listProducts({ featured: true, limit: 8 }) : { products: [] },
    needProducts ? listProducts({ sort: 'newest', limit: 4 }) : { products: [] },
    needProducts ? listProducts({ sort: 'bestselling', limit: 4 }) : { products: [] },
  ]);

  const data = {
    categories,
    collections,
    brands,
    reviews,
    products: {
      featured: featured.products,
      new: newest.products,
      bestsellers: bestsellers.products,
    },
  };

  return <HomeSections sections={sections} data={data} />;
}
