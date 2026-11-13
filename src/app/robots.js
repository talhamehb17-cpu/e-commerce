const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://nova-commerce-eight.vercel.app');

export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    ],
    sitemap: `${siteUrl.replace(/\/$/, '')}/sitemap.xml`,
  };
}
