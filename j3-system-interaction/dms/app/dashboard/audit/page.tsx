'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import { AuditorAuditDashboard } from '@/components/audit/auditor-audit-dashboard';

export default function AuditDashboardPage() {
  return (
    <AuthGuard requiredPermissions={['view:blockchain-audit']} fallbackUrl="/dashboard">
      <AuditorAuditDashboard />
    </AuthGuard>
  );
}
