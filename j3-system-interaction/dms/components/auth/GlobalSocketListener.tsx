'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useSocket } from '@/context/SocketContext';
import { AlertTriangle, FileText } from 'lucide-react';
import { IncidentSeverity } from '@/types';
import { useRouter } from 'next/navigation';

export default function GlobalSocketListener() {
  const socket = useSocket();
  const router = useRouter();

  useEffect(() => {
    if (!socket) return;

    // 1. Listen for new Risk Alerts
    const handleNewAlert = (alert: any) => {
      if (alert.severity === IncidentSeverity.CRITICAL || alert.severity === IncidentSeverity.HIGH) {
        toast.error(`${alert.severity} ALERT: ${alert.title}`, {
          description: `Location: ${alert.district} | Source: ${alert.source || 'System'}`,
          icon: <AlertTriangle size={16} className="text-red-400" />,
          duration: 8000,
          action: {
            label: 'View Alert',
            onClick: () => router.push('/dashboard/alerts'),
          },
        });
      } else {
        toast.info(`${alert.severity} Alert: ${alert.title}`, {
          description: `Location: ${alert.district}`,
          duration: 5000,
          action: {
            label: 'View Alert',
            onClick: () => router.push('/dashboard/alerts'),
          },
        });
      }
    };

    // 2. Listen for new SOS Reports
    const handleNewReport = (report: any) => {
      toast(`New SOS Report: ${report.disasterType}`, {
        description: `Location: ${report.district} | Pending Verification`,
        icon: <FileText size={16} className="text-orange-400" />,
        duration: 5000,
        action: {
          label: 'Review',
          onClick: () => router.push('/dashboard/incoming-reports'),
        },
      });
    };

    // Attach listeners
    socket.on('dashboard:risk-alert', handleNewAlert);
    socket.on('dashboard:new-report', handleNewReport);

    // Cleanup listeners on unmount
    return () => {
      socket.off('dashboard:risk-alert', handleNewAlert);
      socket.off('dashboard:new-report', handleNewReport);
    };
  }, [socket, router]);

  return null; 
}