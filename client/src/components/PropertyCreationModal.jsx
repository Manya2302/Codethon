import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { Loader2, Upload, X } from 'lucide-react';
import MapView from './MapView';

export default function PropertyCreationModal({ open, onClose, onSuccess, reason: initialReason }) {
  const [loading, setLoading] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [selectedPincode, setSelectedPincode] = useState(null);
  const [formData, setFormData] = useState({
    propertyName: '',
    reason: initialReason || 'sale',
    propertyType: '',
    location: '',
    budget: '',
    pincode: '',
    latitude: '',
    longitude: '',
    area: '',
    contact: '',
    description: '',
    assignedBrokerId: ''
  });
  const [brokers, setBrokers] = useState([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    if (open) {
      // Reset form when modal opens
      setFormData({
        propertyName: '',
        reason: initialReason || 'sale',
        propertyType: '',
        location: '',
        budget: '',
        pincode: '',
        latitude: '',
        longitude: '',
        area: '',
        contact: user?.phone || '',
        description: '',
        assignedBrokerId: ''
      });
      setImages([]);
      setImagePreviews([]);
      setSelectedCoordinates(null);
      setSelectedPincode(null);
      setShowMap(false);
      fetchBrokers();
    }
  }, [open, initialReason, user]);

  const fetchBrokers = async () => {
    try {
      setLoadingBrokers(true);
      console.log('[FRONTEND] Fetching brokers from /api/brokers...');
      const response = await fetch('/api/brokers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      console.log('[FRONTEND] Response status:', response.status);
      console.log('[FRONTEND] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('[FRONTEND] Raw response data:', data);
        console.log('[FRONTEND] Data type:', Array.isArray(data) ? 'Array' : typeof data);
        console.log('[FRONTEND] Number of brokers:', Array.isArray(data) ? data.length : 'Not an array');
        
        if (Array.isArray(data)) {
          console.log('[FRONTEND] Broker details:', data.map(b => ({ 
            id: b._id || b.id, 
            name: b.name, 
            email: b.email,
            hasId: !!(b._id || b.id)
          })));
          setBrokers(data);
          if (data.length === 0) {
            console.warn('[FRONTEND] No brokers found in response');
          }
        } else {
          console.error('[FRONTEND] Response is not an array:', data);
          setBrokers([]);
        }
      } else {
        // If 503 (Service Unavailable) or 500, show error
        if (response.status === 503 || response.status === 500) {
          const errorText = await response.text();
          console.error('[FRONTEND] Failed to fetch brokers:', response.status, errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          console.error('[FRONTEND] Error data:', errorData);
          toast({
            title: 'Warning',
            description: errorData.message || 'Could not load brokers. You can still add the property without assigning a broker.',
            variant: 'default',
          });
        }
        // For other status codes, just set empty array (no error toast)
        setBrokers([]);
      }
    } catch (error) {
      console.error('[FRONTEND] Error fetching brokers:', error);
      console.error('[FRONTEND] Error stack:', error.stack);
      toast({
        title: 'Warning',
        description: 'Could not load brokers. You can still add the property without assigning a broker.',
        variant: 'default',
      });
      setBrokers([]);
    } finally {
      setLoadingBrokers(false);
    }
  };

  const handleMapClick = (coords) => {
    setSelectedCoordinates(coords);
    setFormData(prev => ({
      ...prev,
      latitude: coords.lat.toFixed(6),
      longitude: coords.lng.toFixed(6)
    }));
    fetchAddressFromCoordinates(coords.lat, coords.lng);
  };

  const handlePincodeSelect = (pincode) => {
    setSelectedPincode(pincode);
    if (pincode) {
      setFormData(prev => ({
        ...prev,
        pincode: pincode
      }));
    }
  };

  const fetchAddressFromCoordinates = async (lat, lng) => {
    try {
      setFetchingAddress(true);
      const response = await fetch(`/api/map/reverse-geocode?lat=${lat}&lng=${lng}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            location: data.address || prev.location,
            pincode: data.pincode || prev.pincode
          }));
          setSelectedPincode(data.pincode);
          toast({
            title: 'Location Retrieved',
            description: 'Address and pincode have been automatically filled',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching address:', error);
    } finally {
      setFetchingAddress(false);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 4) {
      toast({
        title: 'Error',
        description: 'Maximum 4 images allowed',
        variant: 'destructive',
      });
      return;
    }

    const newImages = [...images, ...files];
    setImages(newImages);

    // Create previews
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
    // Revoke object URL to free memory
    URL.revokeObjectURL(imagePreviews[index]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.propertyName || !formData.reason || !formData.propertyType || 
        !formData.location || !formData.budget || !formData.pincode || 
        !formData.latitude || !formData.longitude || !formData.contact) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // Upload images first (if any)
      const imageFileIds = [];
      console.log('[PropertyModal] Starting image upload, total images:', images.length);
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        console.log(`[PropertyModal] Uploading image ${i + 1}/${images.length}:`, image.name);
        
        const formDataUpload = new FormData();
        formDataUpload.append('image', image);
        
        try {
          const uploadResponse = await fetch('/api/properties/upload-image', {
            method: 'POST',
            body: formDataUpload,
            credentials: 'include'
          });

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            console.log(`[PropertyModal] Image ${i + 1} uploaded successfully:`, uploadData.fileId);
            imageFileIds.push(uploadData.fileId); // Store fileId instead of path
          } else {
            const errorData = await uploadResponse.json().catch(() => ({ message: 'Unknown error' }));
            console.error(`[PropertyModal] Failed to upload image ${i + 1}:`, errorData);
            throw new Error(`Failed to upload image ${i + 1}: ${errorData.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`[PropertyModal] Error uploading image ${i + 1}:`, error);
          throw error;
        }
      }
      
      console.log('[PropertyModal] All images uploaded. Total fileIds:', imageFileIds.length);

      // Get broker info if selected
      let brokerData = {};
      if (formData.assignedBrokerId) {
        const selectedBroker = brokers.find(b => b._id === formData.assignedBrokerId);
        if (selectedBroker) {
          brokerData = {
            assignedBrokerId: selectedBroker._id,
            assignedBrokerName: selectedBroker.name,
            assignedBrokerEmail: selectedBroker.email
          };
        }
      }

      // Create property
      const propertyData = {
        propertyName: formData.propertyName,
        reason: formData.reason,
        propertyType: formData.propertyType,
        location: formData.location,
        budget: parseFloat(formData.budget),
        pincode: formData.pincode,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        area: formData.area ? parseFloat(formData.area) : undefined,
        contact: formData.contact,
        description: formData.description || undefined,
        images: imageFileIds, // Store fileIds in database
        ...brokerData
      };

      console.log('[PropertyModal] Creating property with data:', {
        ...propertyData,
        images: propertyData.images.length + ' images',
        imageFileIds: propertyData.images
      });

      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(propertyData),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Property added successfully',
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to add property',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating property:', error);
      toast({
        title: 'Error',
        description: 'Failed to add property. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Property for {formData.reason === 'sale' ? 'Sale' : 'Lease'}</DialogTitle>
          <DialogDescription>
            Add a new property with location, budget, and details. Click on the map to select location.
          </DialogDescription>
        </DialogHeader>
        
        {user && (
          <div className="mb-4 p-3 bg-muted rounded-md">
            <p className="text-sm"><strong>Vendor:</strong> {user.name}</p>
            <p className="text-sm"><strong>Email:</strong> {user.email}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason (Sale/Lease) */}
          <div>
            <Label htmlFor="reason">Purpose *</Label>
            <Select
              value={formData.reason}
              onValueChange={(value) => setFormData({ ...formData, reason: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select purpose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">For Sale</SelectItem>
                <SelectItem value="lease">For Lease</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Property Name */}
          <div>
            <Label htmlFor="propertyName">Property Name *</Label>
            <Input
              id="propertyName"
              value={formData.propertyName}
              onChange={(e) => setFormData({ ...formData, propertyName: e.target.value })}
              placeholder="e.g., Luxury Villa, Commercial Plot, etc."
              required
            />
          </div>

          {/* Property Type */}
          <div>
            <Label htmlFor="propertyType">Property Type *</Label>
            <Select
              value={formData.propertyType}
              onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="land">Land</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="factory">Factory</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div>
            <Label htmlFor="budget">Budget (₹) *</Label>
            <Input
              id="budget"
              type="number"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              placeholder="e.g., 5000000"
              required
            />
          </div>

          {/* Map Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Select Location on Map *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMap(!showMap)}
              >
                {showMap ? 'Hide Map' : 'Show Map'}
              </Button>
            </div>
            {showMap && (
              <div className="mt-2 border rounded-lg overflow-hidden" style={{ height: '400px' }}>
                <MapView
                  onMapClick={handleMapClick}
                  onPincodeSelect={handlePincodeSelect}
                  selectedPincode={selectedPincode}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {showMap ? 'Click on the map to select property location. Pincode and coordinates will be auto-filled.' : 'Click "Show Map" to select location on map, or enter details manually below.'}
            </p>
          </div>

          {/* Location Details */}
          <div>
            <Label htmlFor="location">Location/Address *</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Navrangpura, Ahmedabad"
              required
              disabled={fetchingAddress}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pincode">Pincode *</Label>
              <Input
                id="pincode"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="e.g., 380015"
                required
                disabled={fetchingAddress}
              />
            </div>
            <div>
              <Label htmlFor="area">Area (sq ft)</Label>
              <Input
                id="area"
                type="number"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="e.g., 2000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude">Latitude *</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="Auto-filled from map"
                required
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude *</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="Auto-filled from map"
                required
              />
            </div>
          </div>

          {/* Contact */}
          <div>
            <Label htmlFor="contact">Contact Number *</Label>
            <Input
              id="contact"
              type="tel"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              placeholder="e.g., +91 9876543210"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add any additional details about the property..."
              rows={3}
            />
          </div>

          {/* Assign Broker */}
          <div>
            <Label htmlFor="assignedBrokerId">Assign Broker (Optional)</Label>
            {loadingBrokers ? (
              <div className="text-sm text-muted-foreground py-2">Loading brokers...</div>
            ) : brokers.length === 0 ? (
              <div className="space-y-2">
                <Select disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="No brokers available" />
                  </SelectTrigger>
                </Select>
                <p className="text-xs text-muted-foreground">
                  No brokers found. Please ensure brokers are registered in the system.
                </p>
              </div>
            ) : (
              <Select
                value={formData.assignedBrokerId || undefined}
                onValueChange={(value) => {
                  console.log('Selected broker:', value);
                  setFormData({ ...formData, assignedBrokerId: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a broker (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((broker) => {
                    console.log('Rendering broker:', broker);
                    return (
                      <SelectItem key={broker._id || broker.id} value={broker._id || broker.id}>
                        {broker.name} ({broker.email})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {brokers.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {brokers.length} broker{brokers.length !== 1 ? 's' : ''} available
              </p>
            )}
            {/* Debug info - remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-muted-foreground mt-1">
                Debug: {brokers.length} brokers loaded. IDs: {brokers.map(b => b._id || b.id).join(', ')}
              </p>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <Label>Property Images (up to 4 images)</Label>
            <div className="mt-2 border-2 border-dashed rounded-lg p-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
                id="image-upload"
                disabled={images.length >= 4}
              />
              <label htmlFor="image-upload">
                <Button type="button" variant="outline" asChild disabled={images.length >= 4}>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Images ({images.length}/4)
                  </span>
                </Button>
              </label>
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Property'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

