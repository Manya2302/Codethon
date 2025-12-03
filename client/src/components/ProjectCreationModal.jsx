import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { MapPin, Loader2, Upload, X, Plus } from 'lucide-react';
import MapView from './MapView';

export default function ProjectCreationModal({ open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [selectedPincode, setSelectedPincode] = useState(null);
  const [formData, setFormData] = useState({
    projectName: '',
    priceMin: '',
    priceMax: '',
    startDate: '',
    endDate: '',
    pincode: '',
    areaName: '',
    latitude: '',
    longitude: '',
    address: '',
    territories: [] // Array of pincodes for territory tagging
  });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [newTerritoryPincode, setNewTerritoryPincode] = useState('');
  const [showMap, setShowMap] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    if (open) {
      // Reset form when modal opens
      setFormData({
        projectName: '',
        priceMin: '',
        priceMax: '',
        startDate: '',
        endDate: '',
        pincode: '',
        areaName: '',
        latitude: '',
        longitude: '',
        address: '',
        territories: []
      });
      setImages([]);
      setImagePreviews([]);
      setSelectedCoordinates(null);
      setSelectedPincode(null);
      setNewTerritoryPincode('');
    }
  }, [open]);

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
            address: data.address || prev.address,
            pincode: data.pincode || prev.pincode,
            areaName: data.locality || data.address || prev.areaName
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

  const addTerritory = () => {
    if (newTerritoryPincode.trim() && !formData.territories.includes(newTerritoryPincode.trim())) {
      setFormData(prev => ({
        ...prev,
        territories: [...prev.territories, newTerritoryPincode.trim()]
      }));
      setNewTerritoryPincode('');
    }
  };

  const removeTerritory = (pincode) => {
    setFormData(prev => ({
      ...prev,
      territories: prev.territories.filter(t => t !== pincode)
    }));
  };

  const calculateStatus = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) return 'not_started';
    if (now > end) return 'finished';
    return 'working';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.projectName || !formData.priceMin || !formData.priceMax || 
        !formData.startDate || !formData.endDate || !formData.pincode || 
        !formData.latitude || !formData.longitude) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (images.length < 1) {
      toast({
        title: 'Error',
        description: 'Please upload at least 1 project image',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // Upload images first
      const imageFileIds = [];
      console.log('[ProjectModal] Starting image upload, total images:', images.length);
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        console.log(`[ProjectModal] Uploading image ${i + 1}/${images.length}:`, image.name);
        
        const formDataUpload = new FormData();
        formDataUpload.append('image', image);
        
        try {
          const uploadResponse = await fetch('/api/projects/upload-image', {
            method: 'POST',
            body: formDataUpload,
            credentials: 'include'
          });

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            console.log(`[ProjectModal] Image ${i + 1} uploaded successfully:`, uploadData.fileId);
            imageFileIds.push(uploadData.fileId); // Store fileId instead of path
          } else {
            const errorData = await uploadResponse.json().catch(() => ({ message: 'Unknown error' }));
            console.error(`[ProjectModal] Failed to upload image ${i + 1}:`, errorData);
            throw new Error(`Failed to upload image ${i + 1}: ${errorData.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`[ProjectModal] Error uploading image ${i + 1}:`, error);
          throw error;
        }
      }
      
      console.log('[ProjectModal] All images uploaded. Total fileIds:', imageFileIds.length);

      // Create project (status will be calculated on server)
      const projectData = {
        projectName: formData.projectName,
        priceRange: {
          min: parseFloat(formData.priceMin),
          max: parseFloat(formData.priceMax)
        },
        images: imageFileIds, // Store fileIds in database
        pincode: formData.pincode,
        areaName: formData.areaName || formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        startDate: formData.startDate,
        endDate: formData.endDate,
        territories: formData.territories.length > 0 ? formData.territories : [formData.pincode]
      };

      console.log('[ProjectModal] Creating project with data:', {
        ...projectData,
        images: projectData.images.length + ' images',
        imageFileIds: projectData.images
      });

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
        credentials: 'include'
      });

      const result = await response.json();
      console.log('[ProjectModal] Project creation response:', {
        ok: response.ok,
        status: response.status,
        result: result
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Project created successfully',
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to create project',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
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
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project with location, pricing, and images. Click on the map to select location.
          </DialogDescription>
        </DialogHeader>
        
        {user && (
          <div className="mb-4 p-3 bg-muted rounded-md">
            <p className="text-sm"><strong>Sales Admin:</strong> {user.name}</p>
            <p className="text-sm"><strong>Email:</strong> {user.email}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <Label htmlFor="projectName">Project Name *</Label>
            <Input
              id="projectName"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              placeholder="e.g., Luxury Apartments Phase 1"
              required
            />
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priceMin">Minimum Price (₹) *</Label>
              <Input
                id="priceMin"
                type="number"
                value={formData.priceMin}
                onChange={(e) => setFormData({ ...formData, priceMin: e.target.value })}
                placeholder="e.g., 5000000"
                required
              />
            </div>
            <div>
              <Label htmlFor="priceMax">Maximum Price (₹) *</Label>
              <Input
                id="priceMax"
                type="number"
                value={formData.priceMax}
                onChange={(e) => setFormData({ ...formData, priceMax: e.target.value })}
                placeholder="e.g., 10000000"
                required
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
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
              {showMap ? 'Click on the map to select project location. Pincode and coordinates will be auto-filled.' : 'Click "Show Map" to select location on map, or enter pincode manually below.'}
            </p>
          </div>

          {/* Location Details */}
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
              <Label htmlFor="areaName">Area Name *</Label>
              <Input
                id="areaName"
                value={formData.areaName}
                onChange={(e) => setFormData({ ...formData, areaName: e.target.value })}
                placeholder="e.g., Navrangpura"
                required
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

          {/* Territory Tagging */}
          <div>
            <Label>Tag Territories (Additional Pincodes)</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={newTerritoryPincode}
                onChange={(e) => setNewTerritoryPincode(e.target.value)}
                placeholder="Enter pincode"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTerritory())}
              />
              <Button type="button" onClick={addTerritory} variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.territories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.territories.map((pincode) => (
                  <span key={pincode} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md text-sm">
                    {pincode}
                    <button
                      type="button"
                      onClick={() => removeTerritory(pincode)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <Label>Project Images (1-4 images) *</Label>
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
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

