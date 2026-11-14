import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { ENV } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ugc-mock-test-staging.web.app'),
  title: { default: 'UrEducator | UGC NET computer-based mock tests', template: '%s | UrEducator' },
  description: 'Full-length UGC NET mock tests on a computer-based exam screen, with topic-level analysis, an error notebook and a revision planner.',
  robots: ENV.noindex ? { index: false, follow: false, nocache: true } : undefined,
  applicationName: 'UrEducator',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1e2d86' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ur_theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
