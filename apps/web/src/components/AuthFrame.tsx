import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui';
export function AuthFrame({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="w-full grid gap-10 px-4 py-14 sm:px-6 lg:px-8 xl:px-12 lg:grid-cols-[1fr_28rem] lg:py-20">
      <div className="hidden max-w-md lg:block"><h1 className="text-5xl leading-[1.05]">{title}</h1>{intro && <p className="mt-4 text-lg text-muted">{intro}</p>}</div>
      <Sheet className="p-6 sm:p-8"><h1 className="text-3xl lg:hidden">{title}</h1>{intro && <p className="mt-2 text-muted lg:hidden">{intro}</p>}<div className="mt-6 lg:mt-0">{children}</div>{footer && <div className="mt-6 border-t border-line pt-4 text-sm text-muted">{footer}</div>}</Sheet>
    </main>
  );
}
