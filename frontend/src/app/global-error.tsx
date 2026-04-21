'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('Global app error:', error);

  return (
    <html lang="fr">
      <body className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg space-y-4">
          <h1 className="text-xl font-semibold">Erreur critique</h1>
          <p className="text-sm text-muted-foreground">
            Une erreur globale est survenue. Réessayez pour relancer
            l&apos;application.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
          >
            Redémarrer
          </button>
        </div>
      </body>
    </html>
  );
}
