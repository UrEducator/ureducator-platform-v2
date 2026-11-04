import type { ReactNode } from 'react';
export function Prose({ title, updated, children, notice }: { title: string; updated?: string; children: ReactNode; notice?: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl sm:text-5xl">{title}</h1>
      {updated && <p className="mt-2 text-sm text-muted">{updated}</p>}
      {notice && <div className="mt-6">{notice}</div>}
      <div className="read mt-8 grid gap-5 text-[1.0625rem] [&_h2]:mt-6 [&_h2]:font-sans [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1.5 [&_a]:text-pen-700 [&_a]:underline">{children}</div>
    </main>
  );
}
