import { useState, useEffect } from 'react';
import { Map, Building2, Plus, Eye, MessageSquare, TrendingUp, Handshake } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import MapView from '@/components/MapView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import PropertyCreationModal from '@/components/PropertyCreationModal';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function TradePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [propertyReason, setPropertyReason] = useState('sale'); // 'sale' or 'lease'
  const [properties, setProperties] = useState([]);
  const [selectedPincode, setSelectedPincode] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [stats, setStats] = useState({
    totalProperties: 0,
    saleProperties: 0,
    leaseProperties: 0,
    activeProperties: 0
  });

  useEffect(() => {
    fetchProperties();
    fetchStats();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/properties', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setProperties(data);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/properties/stats', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handlePropertyCreated = () => {
    fetchProperties();
    fetchStats();
    setShowPropertyModal(false);
    toast({
      title: 'Success',
      description: 'Property added successfully',
    });
  };

  const handleAddProperty = (reason) => {
    setPropertyReason(reason);
    setShowPropertyModal(true);
  };

  const handleDeleteProperty = async (propertyId) => {
    if (!confirm('Are you sure you want to delete this property?')) {
      return;
    }

    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Property deleted successfully',
        });
        fetchProperties();
        fetchStats();
      } else {
        const result = await response.json();
        toast({
          title: 'Error',
          description: result.message || 'Failed to delete property',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete property. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout role="vendor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Handshake className="h-8 w-8" />
              Trade
            </h1>
            <p className="text-muted-foreground">Manage your properties for sale or lease.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleAddProperty('sale')} variant="destructive">
              <Plus className="mr-2 h-4 w-4" />
              Add for Sale
            </Button>
            <Button onClick={() => handleAddProperty('lease')} variant="default">
              <Plus className="mr-2 h-4 w-4" />
              Add for Lease
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProperties}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">For Sale</CardTitle>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.saleProperties}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">For Lease</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.leaseProperties}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeProperties}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="map">Map View</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
          </TabsList>
          <TabsContent value="map" className="space-y-4">
            <MapView
              selectedPincode={selectedPincode}
              onPincodeSelect={setSelectedPincode}
            />
          </TabsContent>
          <TabsContent value="properties">
            <Card>
              <CardHeader>
                <CardTitle>My Properties</CardTitle>
              </CardHeader>
              <CardContent>
                {properties.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No properties added yet. Click "Add for Sale" or "Add for Lease" to get started.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {properties.map((property) => (
                        <TableRow key={property._id}>
                          <TableCell className="font-medium">{property.propertyName}</TableCell>
                          <TableCell>{property.propertyType}</TableCell>
                          <TableCell>
                            <Badge variant={property.reason === 'sale' ? 'destructive' : 'default'}>
                              {property.reason === 'sale' ? 'Sale' : 'Lease'}
                            </Badge>
                          </TableCell>
                          <TableCell>{property.location}</TableCell>
                          <TableCell>₹{property.budget.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={property.status === 'active' ? 'default' : 'secondary'}>
                              {property.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteProperty(property._id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {showPropertyModal && (
        <PropertyCreationModal
          open={showPropertyModal}
          onClose={() => setShowPropertyModal(false)}
          onSuccess={handlePropertyCreated}
          reason={propertyReason}
        />
      )}
    </DashboardLayout>
  );
}

