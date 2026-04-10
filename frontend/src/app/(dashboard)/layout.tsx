'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredAccessToken } from '@/lib/api/client';
import { Sidebar } from '@/components/dashboard/sidebar';
import { TopBar } from '@/components/dashboard/topbar';
import { RouterAlertMonitor } from '@/components/dashboard/router-alert-monitor';
import { SubscriptionBanner } from '@/components/dashboard/subscription-banner';
import { PwaInstallPrompt } from '@/components/pwa/install-prompt';
import { Toaster } from 'sonner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getStoredAccessToken();
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        <SubscriptionBanner />
        <main className="flex-1 overflow-y-auto p-3 md:p-6">{children}</main>
      </div>
      <RouterAlertMonitor />
      <PwaInstallPrompt />
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
