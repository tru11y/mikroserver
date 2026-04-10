'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, LogOut, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearAccessToken } from '@/lib/api/client';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface TopBarProps {
  onMenuToggle: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Server route revokes the token family and clears the httpOnly cookie.
      await api.auth.logout();
    } catch { /* ignore */ }
    clearAccessToken();
    router.push('/login');
  };

  return (
    <header className="h-16 border-b bg-card/50 flex items-center justify-between px-4 flex-shrink-0">
      {/* Hamburger — visible on mobile only */}
      <button
        className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        onClick={onMenuToggle}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop spacer */}
      <div className="hidden md:block" />

      <div className="flex items-center gap-1">
        <NotificationBell />

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Changer le thème"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
          aria-label="Déconnexion"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
