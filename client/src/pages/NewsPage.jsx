import DashboardLayout from '@/components/DashboardLayout';
import RecentNews from '@/components/RecentNews';
import { useUser } from '@/contexts/UserContext';

export default function NewsPage() {
  const { user } = useUser();
  const role = user?.role || 'user';

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Recent News</h1>
          <p className="text-muted-foreground">Stay updated with the latest news and updates.</p>
        </div>
        <RecentNews />
      </div>
    </DashboardLayout>
  );
}

