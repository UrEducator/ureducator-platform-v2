'use client';
import { Alert, Empty, Sheet, Spinner } from '@/components/ui';
import { useLoad, useDocumentTitle } from '@/lib/hooks';

const inr = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);
export default function Page() {
  useDocumentTitle('Pricing');
  const plans = useLoad((b) => b.reads.publishedPlans());
  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl sm:text-5xl">Pricing</h1>
      <Alert tone="info" className="mt-6" title="Payments are switched off in this preview">Nothing can be bought yet. Prices appear below only after an authorised administrator publishes them.</Alert>
      <div className="mt-8">
        {plans.loading ? <Spinner label="Loading plans" /> : plans.error ? <Alert tone="error">We could not load the plans. Try again shortly.</Alert> : !plans.data?.length ? (
          <Empty title="No prices have been published">Free practice tests are open to every account. Paid plans will be listed here, with their full terms, before payments open.</Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">{plans.data.map((p) => (
            <li key={p.id}><Sheet className="p-6"><h2 className="text-2xl">{p.name}</h2><p className="mt-2 text-4xl font-semibold tabular-nums">{inr(p.pricePaise)}</p><p className="text-sm text-muted">for {p.durationDays} days</p><p className="mt-4 text-sm text-muted">Checkout opens when payments are switched on.</p></Sheet></li>
          ))}</ul>
        )}
      </div>
    </main>
  );
}
