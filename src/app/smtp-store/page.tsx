'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navigation } from '@/components/Navigation';
import SmtpStorefront from '@/components/mailer/SmtpStorefront';

export default function SmtpStorePage() {
  return (
    <ProtectedRoute>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-background via-background-secondary to-background pt-20">
        <div className="section-container py-8">
          <SmtpStorefront />
        </div>
      </main>
    </ProtectedRoute>
  );
}
