import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export default function StoreLayout({ children }) {
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
