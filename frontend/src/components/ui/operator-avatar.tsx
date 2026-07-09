import { clsx } from 'clsx';

interface OperatorAvatarProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md';
}

export function OperatorAvatar({ firstName, lastName, size = 'md' }: OperatorAvatarProps) {
  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.15)]',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
      )}
      aria-hidden="true"
    >
      <span
        className={clsx(
          'font-bold text-[hsl(var(--primary))]',
          size === 'sm' ? 'text-[10px]' : 'text-xs',
        )}
      >
        {(firstName[0] ?? '').toUpperCase()}
        {(lastName[0] ?? '').toUpperCase()}
      </span>
    </div>
  );
}
