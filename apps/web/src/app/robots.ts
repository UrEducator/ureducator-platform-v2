import type { MetadataRoute } from 'next';
import { ENV } from '@/lib/env';
export const dynamic = 'force-static';
// Staging and local test builds disallow everything. A production build would publish a real policy.
export default function robots(): MetadataRoute.Robots {
  return ENV.noindex ? { rules: { userAgent: '*', disallow: '/' } } : { rules: { userAgent: '*', allow: '/', disallow: ['/app', '/admin'] } };
}
