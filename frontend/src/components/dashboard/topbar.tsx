'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, LogOut, Menu, Minimize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearAccessToken } from '@/lib/api/client';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface TopBarProps {
  onMenuToggle: () => void;
  onToggleChrome?: () => void;
}

export function TopBar({ onMenuToggle, onToggleChrome }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [dateLabel, setDateLabel] = useState('');

  useEffect(() => {
    setDateLabel(
      new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    );
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch { /* ignore */ }
    clearAccessToken();
    router.push('/login');
  };

  return (
    <header className="h-14 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-2 md:px-4 flex-shrink-0">
      {/* Left — hamburger (mobile) + date (desktop) */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="md:hidden h-11 w-11 -mx-1 inline-flex items-center justify-center rounded-lg tap-transparent active:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={onMenuToggle}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {dateLabel && (
          <span className="hidden md:block text-xs text-muted-foreground capitalize">
            {dateLabel}
          </span>
        )}
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-0.5 md:gap-1.5">
        {onToggleChrome && (
          <button
            type="button"
            onClick={onToggleChrome}
            className="h-11 w-11 md:h-9 md:w-9 inline-flex items-center justify-center rounded-lg tap-transparent active:bg-muted hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Masquer le menu et la barre"
            title="Mode plein écran"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        )}

        <NotificationBell />

        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-11 w-11 md:h-9 md:w-9 inline-flex items-center justify-center rounded-lg tap-transparent active:bg-muted hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Changer le thème"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="h-11 w-11 md:h-9 md:w-9 inline-flex items-center justify-center rounded-lg tap-transparent active:bg-destructive/10 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Déconnexion"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
