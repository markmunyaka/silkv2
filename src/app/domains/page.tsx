'use client';

import { Navigation } from '@/components/Navigation';
import DomainManager from '@/components/DomainManager';

export default function DomainsPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-background via-background-secondary to-background pt-24 pb-16 px-4">
        <DomainManager />
      </main>
    </>
  );
}
