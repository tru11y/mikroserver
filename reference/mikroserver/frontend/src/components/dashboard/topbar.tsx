'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, LogOut, Bell } from 'lucide-react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    const refreshToken = Cookies.get('refresh_token');
    if (refreshToken) {
      try {
        await api.auth.logout(refreshToken);
      } catch { /* ignore */ }
    }
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    router.push('/login');
  };

  return (
    <header className="h-16 border-b bg-card/50 flex items-center justify-between px-6">
      <div />

      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
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
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
