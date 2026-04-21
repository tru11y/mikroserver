'use client';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  console.error('Route error boundary:', error);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg space-y-4">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="text-sm text-muted-foreground">
          Nous n&apos;avons pas pu charger cette page. Vous pouvez réessayer
          sans perdre votre session.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
