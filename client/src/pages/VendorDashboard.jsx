import { useState, useEffect } from 'react';
import { Building2, FileText, Users, TrendingUp, CheckCircle2, Map } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardMetricCard from '@/components/DashboardMetricCard';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AreaAnalytics from '@/components/AreaAnalytics';
import RecentNews from '@/components/RecentNews';

export default function VendorDashboard() {
  const { user } = useUser();
  const [stats, setStats] = useState({
    activeListings: 0,
    totalRevenue: 0,
    inquiries: 0,
    documents: 0,
    listingsChange: 0,
    revenueChange: 0,
    inquiriesChange: 0,
    documentsChange: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchVendorStats();
    }
  }, [user]);

  const fetchVendorStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vendor/stats', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Failed to fetch vendor stats');
      }
    } catch (error) {
      console.error('Error fetching vendor stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="vendor">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" data-testid="text-welcome">
            Welcome, {user?.name || 'Vendor'}!
            {user?.isReraVerified && (
              <Badge variant="default" className="gap-1" data-testid="badge-rera-verified">
                <CheckCircle2 className="h-3 w-3" />
                RERA Verified
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            Manage your properties and connect with potential buyers.
          </p>
          {user?.reraId && (
            <p className="text-sm text-muted-foreground mt-1">
              RERA ID: <span className="font-mono">{user.reraId}</span>
            </p>
          )}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="maps">
              <Map className="h-4 w-4 mr-2" />
              Maps & Area Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardMetricCard
                title="Active Listings"
                value={loading ? "..." : stats.activeListings.toString()}
                change={stats.listingsChange}
                icon={<Building2 className="h-4 w-4" />}
                data-testid="card-listings"
              />
              <DashboardMetricCard
                title="Total Revenue"
                value={loading ? "..." : `$${stats.totalRevenue.toFixed(2)}`}
                change={stats.revenueChange}
                icon={<TrendingUp className="h-4 w-4" />}
                data-testid="card-revenue"
              />
              <DashboardMetricCard
                title="Inquiries"
                value={loading ? "..." : stats.inquiries.toString()}
                change={stats.inquiriesChange}
                icon={<Users className="h-4 w-4" />}
                data-testid="card-inquiries"
              />
              <DashboardMetricCard
                title="Documents"
                value={loading ? "..." : stats.documents.toString()}
                change={stats.documentsChange}
                icon={<FileText className="h-4 w-4" />}
                data-testid="card-documents"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Vendor Features</CardTitle>
                <CardDescription>
                  Your property management dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  As a RERA-verified vendor, you can list properties, manage inquiries, 
                  and connect with potential buyers. Your verified status gives customers 
                  confidence in your listings.
                </p>
              </CardContent>
            </Card>
            <RecentNews />
          </TabsContent>

          <TabsContent value="maps" className="space-y-6">
            <AreaAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
