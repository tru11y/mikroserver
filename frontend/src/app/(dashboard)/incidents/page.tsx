import type { Metadata } from 'next';
import { IncidentsPageClient } from './incidents-page-client';

export const metadata: Metadata = {
  title: "Centre d'incidents — MikroServer",
};

export default function IncidentsPage() {
  return <IncidentsPageClient />;
}
