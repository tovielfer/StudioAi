import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo' });

export const metadata: Metadata = {
  title: 'AI Studio — יצירת תמונות ווידאו',
  description: 'צור תמונות מרהיבות בעזרת בינה מלאכותית',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
