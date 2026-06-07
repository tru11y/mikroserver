import Link from 'next/link';
import { clsx } from 'clsx';

interface MacAddressCellProps {
  mac: string;
  href?: string;
  className?: string;
}

export function MacAddressCell({ mac, href, className }: MacAddressCellProps) {
  const cls = clsx('font-mono text-xs font-semibold tracking-tight', className);
  if (href) {
    return (
      <Link href={href} className={clsx(cls, 'hover:text-primary transition-colors')}>
        {mac}
      </Link>
    );
  }
  return <span className={cls}>{mac}</span>;
}
