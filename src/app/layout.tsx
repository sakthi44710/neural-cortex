import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import SessionProvider from '@/components/providers/SessionProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'Neural Cortex | AI Personal Knowledge Twin',
  description: 'Your AI-powered cognitive extension. Store, connect, and amplify your knowledge with advanced AI.',
};

// Critical inline CSS to prevent FOUC (Flash of Unstyled Content) and honor theme variables
const criticalCSS = `
  html, body {
    background: var(--bg-primary, #090d16) !important;
    color: var(--text-primary, #f1f5f9) !important;
    margin: 0;
    padding: 0;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg-primary, #090d16); }
  ::-webkit-scrollbar-thumb { background: var(--border-custom, #334155); border-radius: 3px; }
`;

const themeInitScript = `
  (function() {
    try {
      var saved = localStorage.getItem('nc_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', saved);
      if (saved === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <SessionProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1a1a25',
                color: '#fff',
                border: '1px solid #2a2a3a',
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
