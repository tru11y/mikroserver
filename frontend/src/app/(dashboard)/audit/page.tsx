import type { Metadata } from 'next';
import { AuditPageClient } from './audit-page-client';

export const metadata: Metadata = {
  title: "Journal d'audit — MikroServer",
  description:
    "Historique append-only des actions sensibles, suppressions, changements et connexions admin.",
};

export default function AuditPage() {
  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Journal d&apos;audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue centralisée des actions sensibles, suppressions, changements et connexions admin.
        </p>
      </header>
      <AuditPageClient />
    </>
  );
}
