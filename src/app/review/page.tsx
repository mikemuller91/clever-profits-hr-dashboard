import ReviewDashboard from '@/components/review/ReviewDashboard';
import DashboardLayout from '@/components/Navigation';

export const dynamic = 'force-dynamic';

export default function ReviewPage() {
  return (
    <DashboardLayout>
      <ReviewDashboard />
    </DashboardLayout>
  );
}
