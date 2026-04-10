import { Suspense } from 'react';
import { PortalContent } from './portal-content';

export default function PortalPage() {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <PortalContent />
    </Suspense>
  );
}

function PortalSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="animate-pulse space-y-4 w-full max-w-md px-4">
        <div className="h-12 bg-gray-200 rounded-xl" />
        <div className="h-48 bg-gray-200 rounded-xl" />
        <div className="h-32 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}
