import { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  Loader2, 
  Hospital, 
  ShoppingBag, 
  TreePine, 
  School, 
  Home,
  Building,
  Utensils,
  Briefcase,
  Activity,
  AlertCircle
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

const categoryIcons = {
  hospital: <Hospital className="h-4 w-4" />,
  school: <School className="h-4 w-4" />,
  park: <TreePine className="h-4 w-4" />,
  shopping_mall: <ShoppingBag className="h-4 w-4" />,
  restaurant: <Utensils className="h-4 w-4" />,
  bank: <Briefcase className="h-4 w-4" />,
  gym: <Activity className="h-4 w-4" />,
  store: <ShoppingBag className="h-4 w-4" />,
  pharmacy: <Hospital className="h-4 w-4" />,
};

const categoryColors = {
  hospital: '#ef4444',
  school: '#3b82f6',
  park: '#22c55e',
  shopping_mall: '#f59e0b',
  restaurant: '#ec4899',
  bank: '#8b5cf6',
  gym: '#14b8a6',
  store: '#f97316',
  pharmacy: '#06b6d4',
};

export default function AreaAnalyticsPage() {
  const { user } = useUser();
  const [pincode, setPincode] = useState('');
  const [loading, setLoading] = useState(false);
  const [poiData, setPoiData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mapCenter, setMapCenter] = useState({ lat: 23.0225, lng: 72.5714 });
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    fetchMapConfig();
  }, []);

  const fetchMapConfig = async () => {
    try {
      const response = await fetch('/api/maps/config');
      if (response.ok) {
        const data = await response.json();
        if (data.enabled && data.apiKey) {
          setApiKey(data.apiKey);
          setApiError(false);
        } else {
          setApiError(true);
        }
      } else {
        setApiError(true);
      }
    } catch (error) {
      console.error('Error fetching map config:', error);
      setApiError(true);
    }
  };

  const handleSearch = async () => {
    if (!pincode.trim()) {
      alert('Please enter a pincode');
      return;
    }

    setLoading(true);
    setSelectedCategory('all');
    try {
      const response = await fetch(`/api/maps/poi-summary?pincode=${pincode}`);
      if (response.ok) {
        const data = await response.json();
        setPoiData(data);
        if (data.location) {
          setMapCenter({ lat: data.location.lat, lng: data.location.lng });
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to fetch area data');
      }
    } catch (error) {
      console.error('Error fetching POI data:', error);
      alert('Failed to fetch area data');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPlaces = () => {
    if (!poiData) return [];
    
    if (selectedCategory === 'all') {
      return poiData.summary.flatMap(cat => 
        cat.places.map(place => ({ ...place, categoryType: cat.type }))
      );
    }
    
    const category = poiData.summary.find(cat => cat.type === selectedCategory);
    return category ? category.places.map(place => ({ ...place, categoryType: category.type })) : [];
  };

  const getFilteredSummary = () => {
    if (!poiData) return [];
    
    if (selectedCategory === 'all') {
      return poiData.summary;
    }
    
    return poiData.summary.filter(cat => cat.type === selectedCategory);
  };

  const mapContainerStyle = {
    width: '100%',
    height: '600px'
  };

  return (
    <DashboardLayout role={user?.role || 'broker'}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-title">
            Area Analytics & Maps
          </h1>
          <p className="text-muted-foreground">
            Explore real estate facilities and amenities in any area
          </p>
        </div>

        {apiError && (
          <Alert variant="destructive" data-testid="alert-api-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Google Maps API is not configured. Please contact your administrator to set up the VITE_GOOGLE_MAPS_API_KEY.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Search by Pincode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Enter pincode (e.g., 380015)"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 min-w-[200px]"
                data-testid="input-pincode"
              />
              <Button onClick={handleSearch} disabled={loading || !apiKey} data-testid="button-search">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Search'
                )}
              </Button>
            </div>

            {poiData && (
              <div className="mt-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Showing results for pincode {pincode}
                </div>
                
                <div className="flex gap-2 flex-wrap mb-4">
                  <Button
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory('all')}
                    data-testid="filter-all"
                  >
                    All Categories
                  </Button>
                  {poiData.summary.map((category) => (
                    <Button
                      key={category.type}
                      variant={selectedCategory === category.type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(category.type)}
                      className="gap-2"
                      data-testid={`filter-${category.type}`}
                    >
                      {categoryIcons[category.type] || <MapPin className="h-4 w-4" />}
                      {category.label} ({category.count})
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {poiData && apiKey && (
          <Card>
            <CardHeader>
              <CardTitle>Interactive Map View</CardTitle>
            </CardHeader>
            <CardContent>
              <LoadScript googleMapsApiKey={apiKey}>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={14}
                  options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: true,
                    fullscreenControl: true,
                  }}
                >
                  {getFilteredPlaces().map((place, index) => (
                    <Marker
                      key={`${place.placeId || place.name}-${index}`}
                      position={place.location}
                      onClick={() => setSelectedMarker(place)}
                      icon={{
                        url: `data:image/svg+xml,${encodeURIComponent(`
                          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" fill="${categoryColors[place.categoryType] || '#6366f1'}" stroke="white" stroke-width="2"/>
                          </svg>
                        `)}`
                      }}
                    />
                  ))}

                  {selectedMarker && (
                    <InfoWindow
                      position={selectedMarker.location}
                      onCloseClick={() => setSelectedMarker(null)}
                    >
                      <div className="p-2">
                        <h3 className="font-semibold text-base mb-1">{selectedMarker.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{selectedMarker.vicinity}</p>
                        {selectedMarker.rating && (
                          <div className="flex items-center gap-1 mb-2">
                            <span className="text-yellow-500">⭐</span>
                            <span className="text-sm font-medium">{selectedMarker.rating}</span>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (selectedMarker.placeId) {
                              window.open(`https://www.google.com/maps/place/?q=place_id:${selectedMarker.placeId}`, '_blank');
                            } else {
                              window.open(`https://www.google.com/maps/search/?api=1&query=${selectedMarker.location.lat},${selectedMarker.location.lng}`, '_blank');
                            }
                          }}
                        >
                          Open in Google Maps
                        </Button>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </LoadScript>
            </CardContent>
          </Card>
        )}

        {poiData && (
          <Card>
            <CardHeader>
              <CardTitle>Facilities Count</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {getFilteredSummary().map((category) => (
                  <Card
                    key={category.type}
                    className="cursor-pointer hover-elevate"
                    data-testid={`category-${category.type}`}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="text-4xl mb-2">{category.icon}</div>
                      <div className="font-semibold text-sm mb-1">{category.label}</div>
                      <div className="text-2xl font-bold text-primary">{category.count}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {category.places.length} places shown
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
