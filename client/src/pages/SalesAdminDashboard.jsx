import { useState, useEffect } from 'react';
import { Map, Building2, Plus, Eye, MessageSquare, TrendingUp } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import MapView from '@/components/MapView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import ProjectCreationModal from '@/components/ProjectCreationModal';
import ProjectList from '@/components/ProjectList';
import RecentNews from '@/components/RecentNews';

export default function SalesAdminDashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedPincode, setSelectedPincode] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalViews: 0,
    totalInquiries: 0
  });

  useEffect(() => {
    fetchProjects();
    fetchStats();
  }, []);

  const fetchProjects = async () => {
    try {
      console.log('[Dashboard] Fetching projects...');
      const response = await fetch('/api/projects', {
        credentials: 'include'
      });
      console.log('[Dashboard] Projects response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[Dashboard] Projects received:', data.length);
        console.log('[Dashboard] Sample project:', data[0]);
        setProjects(data);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('[Dashboard] Error fetching projects:', errorData);
        toast({
          title: 'Error',
          description: errorData.message || 'Failed to fetch projects',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch projects',
        variant: 'destructive',
      });
    }
  };

  const fetchStats = async () => {
    try {
      console.log('[Dashboard] Fetching stats...');
      const response = await fetch('/api/projects/stats', {
        credentials: 'include'
      });
      console.log('[Dashboard] Stats response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[Dashboard] Stats received:', data);
        setStats(data);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('[Dashboard] Error fetching stats:', errorData);
        toast({
          title: 'Error',
          description: errorData.message || 'Failed to fetch stats',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch stats',
        variant: 'destructive',
      });
    }
  };

  const handleProjectCreated = () => {
    fetchProjects();
    fetchStats();
    setShowProjectModal(false);
    toast({
      title: 'Success',
      description: 'Project created successfully',
    });
  };

  return (
    <DashboardLayout role="salesadmin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Sales Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage projects, territories, and monitor engagement.</p>
          </div>
          <Button onClick={() => setShowProjectModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeProjects}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalViews}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inquiries</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInquiries}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="map">Map View</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>
          <TabsContent value="map" className="space-y-4">
            <MapView
              selectedPincode={selectedPincode}
              onPincodeSelect={setSelectedPincode}
            />
          </TabsContent>
          <TabsContent value="projects">
            <ProjectList 
              projects={projects} 
              onRefresh={fetchProjects}
              onProjectSelect={(project) => {
                setSelectedPincode(project.pincode);
                setActiveTab('map'); // Switch to map tab
              }}
            />
          </TabsContent>
        </Tabs>
        <RecentNews />
      </div>

      {showProjectModal && (
        <ProjectCreationModal
          open={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          onSuccess={handleProjectCreated}
        />
      )}
    </DashboardLayout>
  );
}

