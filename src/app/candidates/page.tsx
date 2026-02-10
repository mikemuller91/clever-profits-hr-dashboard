import CandidatesDashboard from '@/components/CandidatesDashboard';
import DashboardLayout from '@/components/Navigation';

export const dynamic = 'force-dynamic';

export default function CandidatesPage() {
  return (
    <DashboardLayout>
      <CandidatesDashboard />
    </DashboardLayout>
  );
}
