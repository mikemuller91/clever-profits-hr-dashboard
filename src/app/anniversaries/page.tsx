import Timeline from '@/components/anniversary/Timeline';
import DashboardLayout from '@/components/Navigation';

export const dynamic = 'force-dynamic';

export default function AnniversariesPage() {
  return (
    <DashboardLayout>
      <Timeline />
    </DashboardLayout>
  );
}
