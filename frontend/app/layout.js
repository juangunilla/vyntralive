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
  title: 'LiveStream Platform',
  description: 'Plataforma de streaming en vivo con chat en tiempo real',
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
