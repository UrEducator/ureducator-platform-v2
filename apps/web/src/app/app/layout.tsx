'use client';
import type { ReactNode } from 'react';
import { RequireAuth } from '@/lib/auth';
/** Everything under /app needs a signed-in account with a confirmed email. The server re-checks on every call. */
export default function Layout({ children }: { children: ReactNode }) { return <RequireAuth verified>{children}</RequireAuth>; }
