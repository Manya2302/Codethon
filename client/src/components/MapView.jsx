import React, { useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow, Polygon, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { ahmedabadPincodes } from "../data/ahmedabadPincodes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Google Maps container style
const mapContainerStyle = {
  width: "100%",
  height: "600px",
};

// Default center (Ahmedabad)
const defaultCenter = {
  lat: 23.0225,
  lng: 72.5714,
};

// Libraries for Google Maps - defined outside component to prevent re-renders
const libraries = ["places", "drawing", "geometry"];

// Get color based on population ranges
const getPopulationColor = (population) => {
  if (!population || population === 0) {
    return {
      fill: '#fee2e2', // Light red default
      border: '#dc2626' // Red border default
    };
  }
  
  if (population < 100000) {
    // Green for < 100,000 - Low population
    return {
      fill: '#22c55e', // Green fill
      border: '#16a34a' // Darker green border
    };
  } else if (population >= 100000 && population <= 250000) {
    // Light Green/Yellow-Green for 100,000 to 250,000 - Medium-low population
    return {
      fill: '#84cc16', // Yellow-green fill
      border: '#65a30d' // Darker yellow-green border
    };
  } else if (population >= 250001 && population <= 560000) {
    // Yellow/Orange for 250,001 to 560,000 - Medium-high population
    return {
      fill: '#f59e0b', // Orange fill
      border: '#d97706' // Darker orange border
    };
  } else {
    // Red for > 560,000 - High population
    return {
      fill: '#dc2626', // Red fill
      border: '#b91c1c' // Darker red border
    };
  }
};

// Marker icons based on role - using SVG for proper color display
const getMarkerIcon = (role) => {
  let color = '#666666'; // Default grey
  let text = 'U'; // Default text
  
  // Set color and text based on role - using distinct colors
  if (role === 'investor') {
    color = '#dc2626'; // Red
    text = 'I';
  } else if (role === 'vendor') {
    color = '#2563eb'; // Blue
    text = 'V';
  } else if (role === 'broker') {
    color = '#eab308'; // Yellow
    text = 'B';
  } else if (role === 'customer') {
    color = '#22c55e'; // Green
    text = 'C';
  }
  
  // Create a colored circle SVG icon
  const svg = `
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="15" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="20" y="26" font-size="16" fill="white" text-anchor="middle" font-weight="bold">${text}</text>
    </svg>
  `;
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 40, height: 40 },
    anchor: { x: 20, y: 20 }
  };
};

// Project marker icon based on status
const getProjectMarkerIcon = (status) => {
  // Create SVG icon with color based on status - using distinct colors
  let color = '#6b7280'; // Default grey
  
  switch (status) {
    case 'working':
      color = '#2563eb'; // Blue
      break;
    case 'finished':
      color = '#22c55e'; // Green
      break;
    case 'not_started':
      color = '#6b7280'; // Grey
      break;
  }
  
  // Create a simple colored circle SVG
  const svg = `
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="15" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="20" y="25" font-size="20" fill="white" text-anchor="middle">P</text>
    </svg>
  `;
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 40, height: 40 },
    anchor: { x: 20, y: 20 }
  };
};

// Property marker icon based on reason (sale or lease)
const getPropertyMarkerIcon = (reason) => {
  // Orange for lease, Green for sale - using distinct colors
  const color = reason === 'lease' ? '#f97316' : '#22c55e'; // Orange for lease, Green for sale
  // PL for lease, PS for sale
  const text = reason === 'lease' ? 'PL' : 'PS';
  
  // Create a simple colored circle SVG with text based on reason
  const svg = `
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="15" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="20" y="25" font-size="14" fill="white" text-anchor="middle" font-weight="bold">${text}</text>
    </svg>
  `;
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 40, height: 40 },
    anchor: { x: 20, y: 20 }
  };
};

// Professional marker icon (grey)
const getProfessionalMarkerIcon = () => {
  // Create a grey circle SVG
  const svg = `
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="15" fill="#6b7280" stroke="white" stroke-width="2"/>
      <circle cx="20" cy="20" r="8" fill="#ffffff"/>
    </svg>
  `;
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 40, height: 40 },
    anchor: { x: 20, y: 20 }
  };
};

// Inner component that only renders when API key is available
function MapViewInner({ selectedPincode: externalSelectedPincode, onPincodeSelect, onMapClick, apiKey, selectedRole = null }) {
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(12);
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // Store all users for filtering
  const [searchPincode, setSearchPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [internalSelectedPincode, setInternalSelectedPincode] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pincodeBoundary, setPincodeBoundary] = useState(null);
  const [pincodePopulation, setPincodePopulation] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const mapRef = useRef(null);
  
  // Use external selectedPincode if provided, otherwise use internal state
  const selectedPincode = externalSelectedPincode !== undefined ? externalSelectedPincode : internalSelectedPincode;

  // Load Google Maps API with the provided key
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });


  // State to track boundary source and status
  const [boundarySource, setBoundarySource] = useState(null);
  const [boundaryError, setBoundaryError] = useState(null);

  // Fetch pincode boundary - try ML-based polygon first, then fallback to OSM
  const fetchPincodeBoundary = useCallback(async (pincode) => {
    setBoundaryError(null);
    setBoundarySource(null);
    
    try {
      console.log(`🗺️ Fetching ML-based boundary for pincode: ${pincode}`);
      
      // Try ML-based polygon API first (uses Google Maps road-network approximation)
      try {
        const mlResponse = await fetch(`/api/pincode/${pincode}/polygon`);
        if (mlResponse.ok) {
          const mlData = await mlResponse.json();
          if (mlData.success && mlData.boundary && mlData.boundary.length > 0) {
            console.log(`✅ ML Boundary generated: ${mlData.source}, points: ${mlData.boundary.length}`);
            setBoundarySource(mlData.source);
            return {
              boundary: mlData.boundary,
              center: mlData.centroid,
              source: mlData.source,
              localities: mlData.localities,
              message: mlData.message
            };
          }
        }
      } catch (mlError) {
        console.warn('⚠️ ML boundary generation failed, trying fallback:', mlError.message);
      }
      
      // Fallback to OpenStreetMap Overpass API
      console.log(`🗺️ Falling back to OSM boundary for pincode: ${pincode}`);
      const response = await fetch(`/api/map/pincode-boundary?pincode=${pincode}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Boundary fetched from: ${data.source}, points: ${data.boundary?.length || 0}`);
        setBoundarySource(data.source);
        
        if (data.approximate) {
          setBoundaryError('Showing approximate boundary (exact data not available)');
        }
        
        return {
          boundary: data.boundary,
          center: data.center,
          source: data.source
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('⚠️ Boundary not found:', errorData.message);
        setBoundaryError(errorData.message || 'Boundary not available');
        return null;
      }
    } catch (error) {
      console.error('Error fetching pincode boundary:', error);
      setBoundaryError('Failed to fetch boundary data');
      return null;
    }
  }, []);

  // Fetch professionals on initial load (independent of pincode selection)
  useEffect(() => {
    fetchProfessionals();
  }, []);

  // Fetch map registrations
  useEffect(() => {
    fetchMapRegistrations();
    fetchProjects();
    fetchProperties();
  }, [selectedPincode]);

  // Fetch projects for map display
  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  // Fetch properties for map display
  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/properties');
      if (response.ok) {
        const data = await response.json();
        // Filter only active properties
        const activeProperties = data.filter(p => p.status === 'active');
        setProperties(activeProperties);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  // Fetch registered professionals for map display
  const fetchProfessionals = async () => {
    try {
      console.log('🔄 Fetching registered professionals for map...');
      const response = await fetch('/api/registered-professionals/map');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Professionals fetched:', data.length, 'professionals');
        // Filter out professionals without valid coordinates
        const professionalsWithCoords = data.filter(p => 
          p.latitude && p.longitude && 
          !isNaN(parseFloat(p.latitude)) && 
          !isNaN(parseFloat(p.longitude))
        );
        console.log('📍 Professionals with valid coordinates:', professionalsWithCoords.length);
        setProfessionals(professionalsWithCoords);
      } else {
        console.error('❌ Failed to fetch professionals:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching professionals:', error);
    }
  };

  const fetchMapRegistrations = async () => {
    try {
      setLoading(true);
      const url = selectedPincode 
        ? `/api/map/registrations?pincode=${selectedPincode}`
        : '/api/map/registrations';
      
      const response = await fetch(url);
      if (response.ok) {
        const mapData = await response.json();
        const usersWithLocation = mapData
          .filter(registration => registration.latitude && registration.longitude)
          .map(registration => ({
            _id: registration._id,
            name: registration.name,
            email: registration.email,
            role: registration.role,
            pincode: registration.pincode,
            locality: registration.locality,
            latitude: registration.latitude,
            longitude: registration.longitude,
            streetAddress: registration.address,
            address: registration.address
          }));
        // Store all users
        setAllUsers(usersWithLocation);
        // Apply role filter if selected
        if (selectedRole) {
          setUsers(usersWithLocation.filter(user => user.role === selectedRole));
        } else {
        setUsers(usersWithLocation);
        }
      }
    } catch (error) {
      console.error('Failed to fetch map registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter users when selectedRole changes
  useEffect(() => {
    if (selectedRole && allUsers.length > 0) {
      setUsers(allUsers.filter(user => user.role === selectedRole));
    } else {
      setUsers(allUsers);
    }
  }, [selectedRole, allUsers]);

  // Fetch population for a pincode
  const fetchPopulation = useCallback(async (pincode) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/map/pincode-population?pincode=${pincode}`);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Server returned non-JSON response:', textResponse.substring(0, 200));
        setPincodePopulation(null);
        alert('Server error: Received invalid response. Please try again.');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.population) {
          setPincodePopulation(data.population);
        } else {
          setPincodePopulation(null);
          alert('Population data not available for this pincode');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setPincodePopulation(null);
        alert(errorData.message || 'Failed to fetch population data');
      }
    } catch (error) {
      console.error('Error fetching population:', error);
      setPincodePopulation(null);
      alert('Failed to fetch population data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle pincode search
  const handleSearch = async () => {
    if (searchPincode.trim()) {
      const pincode = searchPincode.trim();
      setLoading(true);
      
      try {
        // Always fetch boundary from API (uses real OpenStreetMap data)
        const result = await fetchPincodeBoundary(pincode);
        
        if (result && result.boundary && result.boundary.length > 0) {
          // Set the selected pincode
          if (onPincodeSelect) {
            onPincodeSelect(pincode);
          } else {
            setInternalSelectedPincode(pincode);
          }
          
          // Use center from API response or calculate from boundary
          if (result.center) {
            setMapCenter({
              lat: result.center.lat,
              lng: result.center.lng
            });
          } else {
            // Calculate center from boundary
            const lats = result.boundary.map(b => b.lat);
            const lngs = result.boundary.map(b => b.lng);
            setMapCenter({
              lat: (Math.max(...lats) + Math.min(...lats)) / 2,
              lng: (Math.max(...lngs) + Math.min(...lngs)) / 2
            });
          }
          
          setMapZoom(14);
          setPincodeBoundary(result.boundary);
        } else {
          // Check if we have a center point in local data for fallback positioning
          const pincodeData = ahmedabadPincodes.find((p) => p.pincode === pincode);
          if (pincodeData && pincodeData.center) {
            if (onPincodeSelect) {
              onPincodeSelect(pincode);
            } else {
              setInternalSelectedPincode(pincode);
            }
            setMapCenter({
              lat: pincodeData.center[0],
              lng: pincodeData.center[1]
            });
            setMapZoom(14);
            setPincodeBoundary(null);
          } else {
            alert('Boundary not available for this pincode. Try a different one.');
          }
        }
      } catch (error) {
        console.error('Error searching pincode:', error);
        alert('Failed to fetch pincode boundary. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle get population button click
  const handleGetPopulation = async () => {
    if (!selectedPincode) {
      alert('Please search for a pincode first');
      return;
    }
    
    // fetchPopulation already handles loading state
    await fetchPopulation(selectedPincode);
  };

  // Handle pincode selection and zoom
  useEffect(() => {
    if (selectedPincode) {
      setSearchPincode(selectedPincode);
      
      // Fetch boundary from server API (uses real OpenStreetMap data)
      fetchPincodeBoundary(selectedPincode).then(result => {
        if (result && result.boundary && result.boundary.length > 0) {
          setPincodeBoundary(result.boundary);
          
          // Use center from API response
          if (result.center) {
            setMapCenter({
              lat: result.center.lat,
              lng: result.center.lng
            });
          }
        } else {
          // Fallback to local center data for positioning
          const pincodeData = ahmedabadPincodes.find((p) => p.pincode === selectedPincode);
          if (pincodeData && pincodeData.center) {
            setMapCenter({
              lat: pincodeData.center[0],
              lng: pincodeData.center[1]
            });
          }
          setPincodeBoundary(null);
        }
      }).catch(() => {
        // Fallback to local center data for positioning
        const pincodeData = ahmedabadPincodes.find((p) => p.pincode === selectedPincode);
        if (pincodeData && pincodeData.center) {
          setMapCenter({
            lat: pincodeData.center[0],
            lng: pincodeData.center[1]
          });
        }
        setPincodeBoundary(null);
      });

      setMapZoom(14);
      
      // Automatically fetch population when pincode is selected (for color coding)
      fetchPopulation(selectedPincode);
    } else {
      if (externalSelectedPincode === null || externalSelectedPincode === undefined) {
        setMapCenter(defaultCenter);
        setMapZoom(12);
        setSearchPincode("");
        setPincodeBoundary(null);
        setPincodePopulation(null);
        setBoundarySource(null);
        setBoundaryError(null);
      }
    }
  }, [selectedPincode, externalSelectedPincode, fetchPincodeBoundary, fetchPopulation]);

  // Handle map click
  const handleMapClick = (e) => {
    if (onMapClick && e.latLng) {
      onMapClick({
        lat: e.latLng.lat(),
        lng: e.latLng.lng()
      });
    }
  };

  // Handle map load
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Territory Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-red-600">
            Error loading Google Maps. Please check your API key configuration.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Territory Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            Loading Google Maps...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Territory Map</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Enter pincode (e.g., 380015, 380007, 380006)"
            value={searchPincode}
            onChange={(e) => setSearchPincode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
            <Button onClick={handleSearch} disabled={loading}>
              Search Pincode
            </Button>
          {selectedPincode && (
              <>
                <Button 
                  onClick={handleGetPopulation}
                  disabled={loading}
                  variant="secondary"
                >
                  {loading ? 'Loading...' : 'Get Population'}
                </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchPincode("");
                setPincodeBoundary(null);
                    setPincodePopulation(null);
                if (onPincodeSelect) {
                  onPincodeSelect(null);
                } else {
                  setInternalSelectedPincode(null);
                }
                    // Clear users when pincode is cleared
                    setUsers([]);
                    setAllUsers([]);
              }}
            >
              Clear
            </Button>
              </>
            )}
          </div>
          {selectedPincode && (
            <div className="p-3 bg-muted rounded-md space-y-1">
              <p className="text-sm font-medium">
                <strong>Pincode:</strong> {selectedPincode}
                {pincodePopulation && (
                  <> | <strong>Population:</strong> {pincodePopulation.toLocaleString()} people</>
                )}
              </p>
              {boundarySource && (
                <p className="text-xs text-muted-foreground">
                  Boundary source: {boundarySource === 'openstreetmap' ? 'OpenStreetMap (Real Data)' : 
                                   boundarySource === 'nominatim' ? 'Nominatim (Real Data)' : 
                                   boundarySource === 'google_viewport' ? 'Google Maps (Approximate)' : boundarySource}
                </p>
              )}
              {boundaryError && (
                <p className="text-xs text-amber-600">
                  {boundaryError}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="relative w-full" style={{ height: "600px" }}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={mapZoom}
            onLoad={onMapLoad}
            onClick={handleMapClick}
            options={{
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
            }}
          >
            {/* Render pincode boundary polygon with color-coded boundary based on population */}
            {pincodeBoundary && pincodeBoundary.length > 0 && (() => {
              const colors = getPopulationColor(pincodePopulation);
              return (
              <>
                  {/* Fill area with curved boundary - color based on population */}
                <Polygon
                  paths={pincodeBoundary}
                  options={{
                      fillColor: colors.fill,
                      fillOpacity: 0.5, // Increased opacity for better visibility
                      strokeColor: colors.border,
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                    clickable: false,
                    draggable: false,
                    editable: false,
                    geodesic: false, // Set to false for straight lines between points (creates curves with many points)
                    zIndex: 1,
                  }}
                />
                  {/* Small dots border using Polyline - color based on population */}
                <Polyline
                  path={[...pincodeBoundary, pincodeBoundary[0]]} // Close the path by adding first point at end
                  options={{
                    strokeColor: "transparent", // Hide base stroke, use only symbols
                    strokeOpacity: 0,
                    strokeWeight: 0,
                    clickable: false,
                    geodesic: false, // Use straight segments between points (creates smooth curves with many points)
                    zIndex: 2,
                      // Create small dotted pattern like Google Maps - color based on population
                    icons: [{
                      icon: {
                          path: 'M 0,0 m -1,0 a 1,1 0 1,1 2,0 a 1,1 0 1,1 -2,0', // Small circle path
                          fillColor: colors.border,
                          fillOpacity: 0.8,
                          strokeColor: colors.border,
                          strokeWeight: 0.5,
                          strokeOpacity: 0.8,
                          scale: 1.5 // Small dot size
                      },
                      offset: '0%',
                        repeat: '4px' // Small spacing between dots (4px apart for subtle appearance)
                    }]
                  }}
                />
              </>
              );
            })()}

            {/* Render user markers */}
            {users.map((user) => {
              return (
                <Marker
                  key={`user-${user._id}`}
                  position={{
                    lat: user.latitude,
                    lng: user.longitude
                  }}
                  icon={getMarkerIcon(user.role)}
                  onClick={() => setSelectedUser(user)}
                />
              );
            })}

            {/* Render project markers */}
            {projects.map((project) => (
              <Marker
                key={`project-${project._id}`}
                position={{
                  lat: project.latitude,
                  lng: project.longitude
                }}
                icon={getProjectMarkerIcon(project.status)}
                onClick={() => setSelectedProject(project)}
              />
            ))}

            {/* Render property markers */}
            {properties.map((property) => (
              <Marker
                key={`property-${property._id}`}
                position={{
                  lat: property.latitude,
                  lng: property.longitude
                }}
                icon={getPropertyMarkerIcon(property.reason)}
                onClick={() => setSelectedProperty(property)}
              />
            ))}

            {/* Render registered professional markers (black) */}
            {professionals && professionals.length > 0 && professionals.map((professional) => {
              // Ensure coordinates are valid numbers
              const lat = parseFloat(professional.latitude);
              const lng = parseFloat(professional.longitude);
              
              if (isNaN(lat) || isNaN(lng)) {
                console.warn('⚠️ Professional has invalid coordinates:', professional);
                return null;
              }
              
              return (
                <Marker
                  key={`professional-${professional._id || professional.id || Math.random()}`}
                  position={{
                    lat: lat,
                    lng: lng
                  }}
                  icon={getProfessionalMarkerIcon()}
                  onClick={() => setSelectedProfessional(professional)}
                />
              );
            })}

            {/* Info Window for selected project */}
            {selectedProject && (
              <InfoWindow
                position={{
                  lat: selectedProject.latitude,
                  lng: selectedProject.longitude
                }}
                onCloseClick={() => setSelectedProject(null)}
              >
                <div style={{ minWidth: "250px", padding: "8px", color: "#1f2937" }}>
                  <b style={{ fontSize: "16px", color: "#111827", fontWeight: "600" }}>{selectedProject.projectName}</b>
                  <br />
                  <span style={{ fontSize: "12px", color: "#374151", fontWeight: "500" }}>
                    Status: {selectedProject.status === 'working' ? 'Working' : 
                            selectedProject.status === 'finished' ? 'Finished' : 'Not Started'}
                  </span>
                  <br />
                  <br />
                  <div style={{ fontSize: "13px", color: "#1f2937", lineHeight: "1.6" }}>
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Price:</strong> <span style={{ color: "#1f2937" }}>₹{(selectedProject.priceRange.min / 100000).toFixed(1)}L - ₹{(selectedProject.priceRange.max / 100000).toFixed(1)}L</span>
                    <br />
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Location:</strong> <span style={{ color: "#1f2937" }}>{selectedProject.areaName}, {selectedProject.pincode}</span>
                    <br />
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Sales Admin:</strong> <span style={{ color: "#1f2937" }}>{selectedProject.salesAdminName}</span>
                  </div>
                  <br />
                  {selectedProject.images && selectedProject.images.length > 0 && (
                    <>
                      <br />
                      <img 
                        src={(() => {
                          const img = selectedProject.images[0];
                          if (!img) return '';
                          if (img.startsWith('http')) return img;
                          if (img.startsWith('/api/images/')) return img;
                          if (img.startsWith('/uploads/')) {
                            // Extract filename from path
                            const filename = img.split('/').pop();
                            return `/api/images/${filename}`;
                          }
                          // Assume it's a fileId or filename
                          return `/api/images/${img}`;
                        })()}
                        alt={selectedProject.projectName}
                        style={{ width: '100%', maxWidth: '200px', marginTop: '8px' }}
                        onError={(e) => {
                          console.error('[MapView] Failed to load project image:', selectedProject.images[0]);
                          e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('[MapView] Successfully loaded project image:', selectedProject.images[0]);
                        }}
                      />
                    </>
                  )}
                </div>
              </InfoWindow>
            )}

            {/* Info Window for selected property */}
            {selectedProperty && (
              <InfoWindow
                position={{
                  lat: selectedProperty.latitude,
                  lng: selectedProperty.longitude
                }}
                onCloseClick={() => setSelectedProperty(null)}
              >
                <div style={{ minWidth: "250px", padding: "8px", color: "#1f2937" }}>
                  <b style={{ fontSize: "16px", color: "#111827", fontWeight: "600" }}>{selectedProperty.propertyName}</b>
                  <br />
                  <span style={{ 
                    fontSize: "12px", 
                    color: selectedProperty.reason === 'sale' ? '#dc2626' : '#3b82f6', 
                    fontWeight: "500" 
                  }}>
                    {selectedProperty.reason === 'sale' ? 'For Sale' : 'For Lease'}
                  </span>
                  <br />
                  <br />
                  <div style={{ fontSize: "13px", color: "#1f2937", lineHeight: "1.6" }}>
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Type:</strong> <span style={{ color: "#1f2937" }}>{selectedProperty.propertyType}</span>
                    <br />
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Budget:</strong> <span style={{ color: "#1f2937" }}>₹{selectedProperty.budget.toLocaleString()}</span>
                    <br />
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Location:</strong> <span style={{ color: "#1f2937" }}>{selectedProperty.location}, {selectedProperty.pincode}</span>
                    {selectedProperty.area && (
                      <>
                        <br />
                        <strong style={{ color: "#111827", fontWeight: "600" }}>Area:</strong> <span style={{ color: "#1f2937" }}>{selectedProperty.area} sq ft</span>
                      </>
                    )}
                    <br />
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Contact:</strong> <span style={{ color: "#1f2937" }}>{selectedProperty.contact}</span>
                    <br />
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Vendor:</strong> <span style={{ color: "#1f2937" }}>{selectedProperty.vendorName}</span>
                  </div>
                  {selectedProperty.description && (
                    <>
                      <br />
                      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
                        {selectedProperty.description}
                      </div>
                    </>
                  )}
                  {selectedProperty.images && selectedProperty.images.length > 0 && (
                    <>
                      <br />
                      <img 
                        src={(() => {
                          const img = selectedProperty.images[0];
                          if (!img) return '';
                          if (img.startsWith('http')) return img;
                          if (img.startsWith('/api/images/')) return img;
                          if (img.startsWith('/uploads/')) {
                            // Extract filename from path
                            const filename = img.split('/').pop();
                            return `/api/images/${filename}`;
                          }
                          // Assume it's a fileId or filename
                          return `/api/images/${img}`;
                        })()}
                        alt={selectedProperty.propertyName}
                        style={{ width: '100%', maxWidth: '200px', marginTop: '8px' }}
                        onError={(e) => {
                          console.error('[MapView] Failed to load property image:', selectedProperty.images[0]);
                          e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('[MapView] Successfully loaded property image:', selectedProperty.images[0]);
                        }}
                      />
                    </>
                  )}
                  {selectedProperty.assignedBrokerId && (
                    <>
                      <br />
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/meetings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ propertyId: selectedProperty._id }),
                              credentials: 'include'
                            });
                            if (response.ok) {
                              alert('Meeting request sent to broker successfully!');
                            } else {
                              const data = await response.json();
                              alert(data.message || 'Failed to send meeting request');
                            }
                          } catch (error) {
                            console.error('Error sending meeting request:', error);
                            alert('Failed to send meeting request');
                          }
                        }}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          padding: '10px',
                          backgroundColor: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}
                      >
                        Arrange Meeting
                      </button>
                    </>
                  )}
                </div>
              </InfoWindow>
            )}

            {/* Info Window for selected professional */}
            {selectedProfessional && (
              <InfoWindow
                position={{
                  lat: selectedProfessional.latitude,
                  lng: selectedProfessional.longitude
                }}
                onCloseClick={() => setSelectedProfessional(null)}
              >
                <div style={{ minWidth: "200px", padding: "8px", color: "#1f2937" }}>
                  <b style={{ fontSize: "16px", color: "#111827", fontWeight: "600" }}>
                    {selectedProfessional.name}
                  </b>
                  <br />
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    Type: {selectedProfessional.type}
                  </span>
                  <br />
                  <br />
                  <div style={{ fontSize: "13px", color: "#1f2937", lineHeight: "1.6" }}>
                    <strong style={{ color: "#111827", fontWeight: "600" }}>Phone:</strong> 
                    <span style={{ color: "#1f2937" }}> {selectedProfessional.phone}</span>
                    <br />
                    {selectedProfessional.pincode && (
                      <>
                        <strong style={{ color: "#111827", fontWeight: "600" }}>Pincode:</strong> 
                        <span style={{ color: "#1f2937" }}> {selectedProfessional.pincode}</span>
                      </>
                    )}
                  </div>
                  <br />
                  <div style={{ 
                    background: "#f3f4f6", 
                    padding: "8px", 
                    borderRadius: "4px",
                    marginTop: "8px"
                  }}>
                    <strong style={{ color: "#000000" }}>
                      🖤 Registered Professional
                    </strong>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* Info Window for selected user */}
            {selectedUser && (
              <InfoWindow
                position={{
                  lat: selectedUser.latitude,
                  lng: selectedUser.longitude
                }}
                onCloseClick={() => setSelectedUser(null)}
              >
                <div style={{ minWidth: "200px", padding: "8px" }}>
                  <b style={{ 
                    fontSize: "16px", 
                    color: selectedUser.role === 'investor' ? "#dc2626" : 
                           selectedUser.role === 'vendor' ? "#2563eb" : 
                           selectedUser.role === 'broker' ? "#eab308" : 
                           selectedUser.role === 'customer' ? "#3b82f6" : "#666" 
                  }}>
                    {selectedUser.name}
                  </b>
                  <br />
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    Role: {selectedUser.role}
                  </span>
                  <br />
                  <br />
                  {selectedUser.email && (
                    <>
                      <strong>Email:</strong> {selectedUser.email}
                      <br />
                    </>
                  )}
                  {(selectedUser.streetAddress || selectedUser.address) && (
                    <>
                      <strong>Address:</strong> {selectedUser.streetAddress || selectedUser.address}
                      <br />
                    </>
                  )}
                  {selectedUser.locality && (
                    <>
                      <strong>Locality:</strong> {selectedUser.locality}
                      <br />
                    </>
                  )}
                  {selectedUser.pincode && (
                    <>
                      <strong>Pincode:</strong> {selectedUser.pincode}
                      <br />
                    </>
                  )}
                  <br />
                  <div style={{ 
                    background: selectedUser.role === 'investor' ? "#fee2e2" : 
                               selectedUser.role === 'vendor' ? "#dbeafe" : 
                               selectedUser.role === 'broker' ? "#fef9c3" : 
                               selectedUser.role === 'customer' ? "#dbeafe" : "#f3f4f6", 
                    padding: "8px", 
                    borderRadius: "4px",
                    marginTop: "8px"
                  }}>
                    <strong style={{ 
                      color: selectedUser.role === 'investor' ? "#dc2626" : 
                             selectedUser.role === 'vendor' ? "#2563eb" : 
                             selectedUser.role === 'broker' ? "#eab308" : 
                             selectedUser.role === 'customer' ? "#3b82f6" : "#666" 
                    }}>
                      {selectedUser.role === 'investor' ? "🏢 Investor" : 
                       selectedUser.role === 'vendor' ? "🏪 Vendor" : 
                       selectedUser.role === 'broker' ? "🤝 Broker" : 
                       selectedUser.role === 'customer' ? "🏠 Customer" : selectedUser.role}
                    </strong>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </CardContent>
    </Card>
  );
}

// Wrapper component that fetches API key and conditionally renders map
export default function MapView(props) {
  const [apiKey, setApiKey] = useState(null);
  
  useEffect(() => {
    fetch('/api/maps/config')
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) {
          setApiKey(data.apiKey);
        } else {
          setApiKey(''); // Set to empty to prevent infinite loading
        }
      })
      .catch(err => {
        console.error('Error fetching Maps config:', err);
        setApiKey(''); // Set to empty on error
      });
  }, []);

  // Show loading state while fetching API key
  if (apiKey === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Territory Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8">
            Loading Maps configuration...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error if no API key available
  if (!apiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Territory Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-red-600">
            Google Maps API key not configured. Please contact administrator.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render the map with the API key
  return <MapViewInner {...props} apiKey={apiKey} selectedRole={props.selectedRole} />;
}
