'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallState = 'idle' | 'ios-prompt' | 'android-prompt' | 'installed';

function isIos(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

const DISMISSED_KEY = 'pwa_install_dismissed_at';
const DISMISS_COOLDOWN_DAYS = 7;

export function PwaInstallPrompt() {
  const [state, setState] = useState<InstallState>('idle');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isInStandaloneMode()) {
      setState('installed');
      return;
    }

    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const diff = Date.now() - parseInt(dismissedAt, 10);
      if (diff < DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState('android-prompt');
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (isIos() && !isInStandaloneMode()) {
      setState('ios-prompt');
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setState('idle');
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setState('installed');
    else dismiss();
    setDeferredPrompt(null);
  };

  if (state === 'idle' || state === 'installed') return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Installer MikroServer</p>
            {state === 'ios-prompt' ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Appuyez sur <strong>Partager</strong> puis <strong>«&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;»</strong> pour installer l&apos;app.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Accès rapide depuis votre écran d&apos;accueil, sans navigateur.
              </p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {state === 'android-prompt' && (
          <button
            onClick={installAndroid}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            Installer l&apos;application
          </button>
        )}
      </div>
    </div>
  );
}
