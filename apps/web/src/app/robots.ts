import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/dashboard/',
        '/history/',
        '/login/',
        '/register/',
        '/forgot-password/',
        '/reset-password/',
        '/verify-email/',
      ],
    },
    sitemap: 'https://vookapix.com/sitemap.xml',
  };
}
