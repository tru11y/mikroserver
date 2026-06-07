import { clsx } from 'clsx';

interface ResellerAvatarProps {
  firstName: string;
  lastName: string;
  role: string;
  size?: 'sm' | 'md';
  className?: string;
}

const roleCfg: Record<string, { bg: string; ring: string; text: string }> = {
  SUPER_ADMIN: {
    bg: 'bg-primary/20',
    ring: 'ring-primary/30',
    text: 'text-primary',
  },
  ADMIN: {
    bg: 'bg-info/15',
    ring: 'ring-info/25',
    text: 'text-info',
  },
  RESELLER: {
    bg: 'bg-success/15',
    ring: 'ring-success/25',
    text: 'text-success',
  },
  VIEWER: {
    bg: 'bg-muted/40',
    ring: 'ring-border',
    text: 'text-muted-foreground',
  },
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || 'U';
}

export function ResellerAvatar({ firstName, lastName, role, size = 'md', className }: ResellerAvatarProps) {
  const c = roleCfg[role] ?? roleCfg.VIEWER;
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-2xl font-semibold ring-1',
        c.bg, c.ring, c.text,
        size === 'sm' ? 'h-10 w-10 text-sm' : 'h-14 w-14 text-base',
        className,
      )}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
}
