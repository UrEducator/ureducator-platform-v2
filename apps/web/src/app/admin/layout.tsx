'use client';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { RequireAuth } from '@/lib/auth';
/** Staff area. The route guard is a convenience: every callable re-checks the signed role claim on the server. */
export default function Layout({ children }: { children: ReactNode }) { return <RequireAuth verified staff><AdminShell>{children}</AdminShell></RequireAuth>; }
