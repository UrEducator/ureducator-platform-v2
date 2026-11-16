import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <><SiteHeader /><div id="main" tabIndex={-1} className="w-full outline-none">{children}</div><SiteFooter /></>;
}
