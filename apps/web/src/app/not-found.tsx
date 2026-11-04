import { LinkButton } from '@/components/ui';
export default function NotFound() {
  return (
    <main id="main" className="mx-auto grid min-h-[70vh] max-w-xl place-content-center gap-4 px-6 text-center">
      <h1 className="text-4xl">That page does not exist</h1>
      <p className="text-muted">The link may be old, or the address may have a typo.</p>
      <div className="flex justify-center gap-3"><LinkButton href="/">Go to the home page</LinkButton><LinkButton href="/app" variant="secondary">Open your dashboard</LinkButton></div>
    </main>
  );
}
