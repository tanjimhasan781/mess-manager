import type { Metadata, Viewport } from 'next';
import { RegisterSW } from '@/components/RegisterSW';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mess Manager',
  description: 'Daily and monthly costs for our mess, with a notification for every cut.',
  appleWebApp: { capable: true, title: 'Mess', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#0f766e', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
