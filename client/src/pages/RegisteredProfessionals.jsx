import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Search, Filter, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const PROFESSIONAL_TYPES = ['Architect', 'Engineer', 'Interior Designer', 'Consultant'];
const LANGUAGES = ['English', 'Hindi', 'Gujarati'];

export default function RegisteredProfessionals() {
  const { toast } = useToast();
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPincode, setFilterPincode] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState(null);
  const [pincodeCount, setPincodeCount] = useState(null);
  const [checkingPincode, setCheckingPincode] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    pincode: '',
    type: '',
    languages: [],
    latitude: '',
    longitude: ''
  });

  const limit = 10;

  useEffect(() => {
    fetchProfessionals();
  }, [page, searchTerm, filterPincode, filterType]);

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (filterPincode) params.append('pincode', filterPincode);
      if (filterType) params.append('type', filterType);

      const response = await fetch(`/api/registered-professionals?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setProfessionals(data.professionals || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch professionals',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching professionals:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch professionals',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkPincodeAvailability = async (pincode) => {
    if (!pincode || pincode.length < 6) {
      setPincodeCount(null);
      return;
    }

    try {
      setCheckingPincode(true);
      const response = await fetch(`/api/registered-professionals/pincode/${pincode}/count`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setPincodeCount(data);
      }
    } catch (error) {
      console.error('Error checking pincode:', error);
    } finally {
      setCheckingPincode(false);
    }
  };

  useEffect(() => {
    if (formData.pincode) {
      const timeoutId = setTimeout(() => {
        checkPincodeAvailability(formData.pincode);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPincodeCount(null);
    }
  }, [formData.pincode]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLanguageToggle = (language) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter(l => l !== language)
        : [...prev.languages, language]
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      pincode: '',
      type: '',
      languages: [],
      latitude: '',
      longitude: ''
    });
    setEditingProfessional(null);
    setPincodeCount(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        languages: formData.languages,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined
      };

      const url = editingProfessional 
        ? `/api/registered-professionals/${editingProfessional._id}`
        : '/api/registered-professionals';
      
      const method = editingProfessional ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: editingProfessional 
            ? 'Professional updated successfully' 
            : 'Professional created successfully'
        });
        setIsDialogOpen(false);
        resetForm();
        fetchProfessionals();
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to save professional',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error saving professional:', error);
      toast({
        title: 'Error',
        description: 'Failed to save professional',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (professional) => {
    setEditingProfessional(professional);
    setFormData({
      name: professional.name || '',
      email: professional.email || '',
      phone: professional.phone || '',
      address: professional.address || '',
      pincode: professional.pincode || '',
      type: professional.type || '',
      languages: professional.languages || [],
      latitude: professional.latitude?.toString() || '',
      longitude: professional.longitude?.toString() || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this professional?')) {
      return;
    }

    try {
      const response = await fetch(`/api/registered-professionals/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Professional deleted successfully'
        });
        fetchProfessionals();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.message || 'Failed to delete professional',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error deleting professional:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete professional',
        variant: 'destructive'
      });
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterPincode('');
    setFilterType('');
    setPage(1);
  };

  return (
    <DashboardLayout role="superadmin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Registered Professionals</h1>
            <p className="text-muted-foreground">Manage registered professionals for each pincode (max 2 per pincode)</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Professional
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProfessional ? 'Edit Professional' : 'Add New Professional'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => handleInputChange('type', value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFESSIONAL_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pincode">Pincode *</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => handleInputChange('pincode', e.target.value)}
                      required
                    />
                    {checkingPincode && (
                      <p className="text-xs text-muted-foreground">Checking availability...</p>
                    )}
                    {pincodeCount !== null && !checkingPincode && (
                      <p className={`text-xs ${pincodeCount.available ? 'text-green-600' : 'text-red-600'}`}>
                        {pincodeCount.available 
                          ? `✓ Available (${pincodeCount.count}/2 professionals)` 
                          : `✗ Full (${pincodeCount.count}/2 professionals)`}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="languages">Languages</Label>
                    <div className="flex gap-4 mt-2">
                      {LANGUAGES.map(lang => (
                        <div key={lang} className="flex items-center space-x-2">
                          <Checkbox
                            id={`lang-${lang}`}
                            checked={formData.languages.includes(lang)}
                            onCheckedChange={() => handleLanguageToggle(lang)}
                          />
                          <Label htmlFor={`lang-${lang}`} className="cursor-pointer">
                            {lang}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude (optional)</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => handleInputChange('latitude', e.target.value)}
                      placeholder="Auto-geocoded if empty"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude (optional)</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => handleInputChange('longitude', e.target.value)}
                      placeholder="Auto-geocoded if empty"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pincodeCount && !pincodeCount.available && !editingProfessional}>
                    {editingProfessional ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Professionals List</CardTitle>
              <div className="flex items-center gap-2">
                {(searchTerm || filterPincode || filterType) && (
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, phone..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Input
                  placeholder="Filter by pincode"
                  value={filterPincode}
                  onChange={(e) => {
                    setFilterPincode(e.target.value);
                    setPage(1);
                  }}
                  className="w-[150px]"
                />
                <Select
                  value={filterType || undefined}
                  onValueChange={(value) => {
                    setFilterType(value === 'all' ? '' : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {PROFESSIONAL_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : professionals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No professionals found
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Pincode</TableHead>
                          <TableHead>Languages</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {professionals.map((professional) => (
                          <TableRow key={professional._id}>
                            <TableCell className="font-medium">{professional.name}</TableCell>
                            <TableCell>{professional.email}</TableCell>
                            <TableCell>{professional.phone}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{professional.type}</Badge>
                            </TableCell>
                            <TableCell>{professional.pincode}</TableCell>
                            <TableCell>
                              {professional.languages && professional.languages.length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {professional.languages.map(lang => (
                                    <Badge key={lang} variant="secondary" className="text-xs">
                                      {lang}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(professional)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(professional._id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} professionals
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

