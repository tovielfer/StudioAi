import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { FeedbackWidget } from '@/components/FeedbackWidget';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo' });

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'vookaPix — יצירת תמונות ווידאו בבינה מלאכותית',
  description: 'צור תמונות וסרטונים מרהיבים בעזרת בינה מלאכותית עם vookaPix. מחולל תמונות ווידאו מתקדם, מהיר וקל לשימוש בעברית.',
  keywords: ['בינה מלאכותית', 'יצירת תמונות', 'יצירת וידאו', 'מחולל תמונות', 'AI', 'vookaPix', 'ווקפיקס'],
  metadataBase: new URL('https://vookapix.com'),
  openGraph: {
    title: 'vookaPix — יצירת תמונות ווידאו בבינה מלאכותית',
    description: 'צור תמונות וסרטונים מרהיבים בעזרת בינה מלאכותית עם vookaPix. מחולל תמונות ווידאו מתקדם בעברית.',
    url: 'https://vookapix.com',
    siteName: 'vookaPix',
    locale: 'he_IL',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'vookaPix',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans antialiased flex min-h-screen flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <FeedbackWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
