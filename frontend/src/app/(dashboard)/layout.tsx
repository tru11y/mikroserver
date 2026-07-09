'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PanelsTopLeft } from 'lucide-react';
import { getStoredAccessToken } from '@/lib/api/client';
import { Sidebar } from '@/components/dashboard/sidebar';
import { TopBar } from '@/components/dashboard/topbar';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { QuickActionFab } from '@/components/dashboard/quick-action-fab';
import { RouterAlertMonitor } from '@/components/dashboard/router-alert-monitor';
import { SubscriptionBanner } from '@/components/dashboard/subscription-banner';
import { PwaInstallPrompt } from '@/components/pwa/install-prompt';
import { CommandBar } from '@/components/command-bar/command-bar';
import { useCommandBar } from '@/components/command-bar/use-command-bar';
import { CaisseModal } from '@/components/caisse/caisse-modal';
import { Toaster } from 'sonner';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [caisseOpen, setCaisseOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandBar();
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
    const token = getStoredAccessToken();
    if (!token) {
      router.push('/login');
    }
    setChromeHidden(localStorage.getItem('chrome-hidden') === '1');
  }, [router]);

  const toggleChrome = () =>
    setChromeHidden((prev) => {
      const next = !prev;
      try { localStorage.setItem('chrome-hidden', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!mounted) return null;

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {!chromeHidden && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!chromeHidden && (
          <>
            <TopBar
              onMenuToggle={() => setSidebarOpen((prev) => !prev)}
              onToggleChrome={toggleChrome}
            />
            <SubscriptionBanner />
          </>
        )}
        <main className="flex-1 overflow-y-auto overscroll-contain-y p-3 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 md:p-6">
          {children}
        </main>
      </div>

      {chromeHidden && (
        <button
          type="button"
          onClick={toggleChrome}
          className="fixed left-3 top-3 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-card/90 backdrop-blur-sm text-muted-foreground shadow-lg transition-colors hover:text-foreground"
          aria-label="Afficher le menu et la barre"
          title="Afficher l'interface"
        >
          <PanelsTopLeft className="h-5 w-5" />
        </button>
      )}

      {!chromeHidden && <MobileNav />}
      <QuickActionFab onOpenCaisse={() => setCaisseOpen(true)} />
      <CommandBar
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onOpenCaisse={() => { setCmdOpen(false); setCaisseOpen(true); }}
      />
      <CaisseModal open={caisseOpen} onClose={() => setCaisseOpen(false)} />
      <RouterAlertMonitor />
      <PwaInstallPrompt />
      <Toaster
        position={isMobile ? 'top-center' : 'top-right'}
        richColors
        closeButton
        toastOptions={{ duration: 4000 }}
      />
    </div>
  );
}
