import TalentPoolDashboard from '@/components/TalentPoolDashboard';
import DashboardLayout from '@/components/Navigation';

export const dynamic = 'force-dynamic';

export default function TalentPoolPage() {
  return (
    <DashboardLayout>
      <TalentPoolDashboard />
    </DashboardLayout>
  );
}
