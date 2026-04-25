import { Instrument_Sans, Space_Grotesk } from 'next/font/google';
import './globals.css';
import TopbarClient from '../components/TopbarClient';

const bodyFont = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body',
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata = {
  title: 'Vyntra Live',
  description: 'Plataforma de streaming en vivo con chat en tiempo real',
  icons: {
    icon: '/logo.jpeg',
    apple: '/logo.jpeg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <div className="site-shell">
          <header className="site-topbar">
            <TopbarClient />
          </header>

          <main className="site-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
