'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
        <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728" />
        </svg>
      </div>
      <h1 className="text-xl font-bold mb-2">Pas de connexion</h1>
      <p className="text-muted-foreground text-sm max-w-xs">
        Vérifiez votre connexion internet et réessayez.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
      >
        Réessayer
      </button>
    </div>
  );
}
