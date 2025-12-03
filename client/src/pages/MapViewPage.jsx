import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import MapView from '@/components/MapView';
import MapRegistrationModal from '@/components/MapRegistrationModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUser } from '@/contexts/UserContext';
import { Users, Building2, TrendingUp, Home } from 'lucide-react';

export default function MapViewPage() {
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [checking, setChecking] = useState(true);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [selectedPincode, setSelectedPincode] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleCounts, setRoleCounts] = useState({
    customer: 0,
    broker: 0,
    investor: 0,
    vendor: 0
  });

  useEffect(() => {
    // Check if register query parameter is present
    const params = new URLSearchParams(window.location.search);
    if (params.get('register') === 'true') {
      setShowRegistrationModal(true);
      // Remove query parameter from URL
      setLocation('/map');
    }
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      setChecking(true);
      const response = await fetch('/api/map/check-registration', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setIsRegistered(data.registered);
      }
    } catch (error) {
      console.error('Error checking registration:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleRegistrationSuccess = () => {
    setIsRegistered(true);
    checkRegistrationStatus();
  };

  // Determine role from URL path
  const getRoleFromPath = () => {
    if (location.includes('/broker/')) return 'broker';
    if (location.includes('/investor/')) return 'investor';
    if (location.includes('/vendor/')) return 'vendor';
    if (location.includes('/customer/')) return 'customer';
    return user?.role || 'user';
  };

  // Fetch role counts when pincode changes
  useEffect(() => {
    if (selectedPincode) {
      fetchRoleCounts(selectedPincode);
    } else {
      setRoleCounts({ customer: 0, broker: 0, investor: 0, vendor: 0 });
      setSelectedRole(null); // Clear role filter when pincode is cleared
    }
  }, [selectedPincode]);

  const fetchRoleCounts = async (pincode) => {
    try {
      const response = await fetch(`/api/map/registrations?pincode=${pincode}`);
      if (response.ok) {
        const data = await response.json();
        const counts = {
          customer: data.filter(u => u.role === 'customer').length,
          broker: data.filter(u => u.role === 'broker').length,
          investor: data.filter(u => u.role === 'investor').length,
          vendor: data.filter(u => u.role === 'vendor').length
        };
        setRoleCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching role counts:', error);
    }
  };

  const handleRoleCardClick = (role) => {
    if (selectedRole === role) {
      // If clicking the same role, deselect it
      setSelectedRole(null);
    } else {
      // Select the clicked role
      setSelectedRole(role);
    }
  };

  return (
    <DashboardLayout role={getRoleFromPath()}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Territory Map</h1>
            <p className="text-muted-foreground">Search by pincode to view vendors, investors, brokers, and customers in the area.</p>
          </div>
          {!checking && !isRegistered && (
            <Button
              onClick={() => {
                setSelectedCoordinates(null);
                setShowRegistrationModal(true);
              }}
              className="flex items-center gap-2"
            >
              <span>Register Yourself on Map</span>
            </Button>
          )}
        </div>

        {/* Role Filter Cards - Only show when pincode is selected */}
        {selectedPincode && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedRole === 'customer' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleRoleCardClick('customer')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <Home className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Customers</p>
                    <p className="text-2xl font-bold">{roleCounts.customer}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedRole === 'broker' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleRoleCardClick('broker')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                    <Users className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Brokers</p>
                    <p className="text-2xl font-bold">{roleCounts.broker}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedRole === 'investor' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleRoleCardClick('investor')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Investors</p>
                    <p className="text-2xl font-bold">{roleCounts.investor}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedRole === 'vendor' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleRoleCardClick('vendor')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Vendors</p>
                    <p className="text-2xl font-bold">{roleCounts.vendor}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <MapView 
          selectedPincode={selectedPincode}
          onPincodeSelect={setSelectedPincode}
          selectedRole={selectedRole}
          onMapClick={(coords) => {
            setSelectedCoordinates(coords);
            setShowRegistrationModal(true);
          }} 
        />
      </div>
      <MapRegistrationModal
        open={showRegistrationModal}
        onClose={() => {
          setShowRegistrationModal(false);
          setSelectedCoordinates(null);
        }}
        onSuccess={handleRegistrationSuccess}
        initialCoordinates={selectedCoordinates}
      />
    </DashboardLayout>
  );
}

