import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, MessageSquare, MapPin, Calendar, DollarSign, Trash2, Edit, TrendingUp, Tag, BarChart3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ProjectList({ projects, onRefresh, onProjectSelect }) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showEngagementModal, setShowEngagementModal] = useState(false);
  const [offerForm, setOfferForm] = useState({
    title: '',
    description: '',
    discount: '',
    validFrom: '',
    validTo: ''
  });
  const { toast } = useToast();

  const getStatusColor = (status) => {
    switch (status) {
      case 'working':
        return 'bg-blue-500';
      case 'finished':
        return 'bg-green-500';
      case 'not_started':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'working':
        return 'Working';
      case 'finished':
        return 'Finished';
      case 'not_started':
        return 'Not Started';
      default:
        return status;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const formatPrice = (min, max) => {
    return `₹${(min / 100000).toFixed(1)}L - ₹${(max / 100000).toFixed(1)}L`;
  };

  const handleLaunchOffer = async () => {
    if (!offerForm.title || !offerForm.discount || !offerForm.validFrom || !offerForm.validTo) {
      toast({
        title: 'Error',
        description: 'Please fill in all offer fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`/api/projects/${selectedProject._id}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm),
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Offer launched successfully',
        });
        setShowOfferModal(false);
        setOfferForm({ title: '', description: '', discount: '', validFrom: '', validTo: '' });
        onRefresh();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.message || 'Failed to launch offer',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to launch offer',
        variant: 'destructive',
      });
    }
  };

  const handleViewEngagement = (project) => {
    setSelectedProject(project);
    setShowEngagementModal(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No projects found. Create your first project to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <Card key={project._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{project.projectName}</h3>
                        <Badge className={getStatusColor(project.status)}>
                          {getStatusLabel(project.status)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          <span>{formatPrice(project.priceRange.min, project.priceRange.max)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{project.pincode} - {project.areaName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          <span>{project.engagement?.views || 0} views</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          <span>{project.engagement?.inquiries || 0} inquiries</span>
                        </div>
                      </div>

                      {project.territories && project.territories.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-muted-foreground">Territories: </span>
                          {project.territories.map((pincode, idx) => (
                            <Badge key={idx} variant="outline" className="mr-1 text-xs">
                              {pincode}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {project.offers && project.offers.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-muted-foreground">Active Offers: </span>
                          {project.offers.filter(o => o.isActive).map((offer, idx) => (
                            <Badge key={idx} variant="secondary" className="mr-1 text-xs bg-green-500">
                              {offer.title} ({offer.discount}% off)
                            </Badge>
                          ))}
                        </div>
                      )}

                      {project.images && project.images.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {project.images.slice(0, 3).map((image, idx) => {
                            const imageUrl = (() => {
                              if (!image) return '';
                              if (image.startsWith('http')) return image;
                              if (image.startsWith('/api/images/')) return image;
                              if (image.startsWith('/uploads/')) {
                                // Extract filename from path
                                const filename = image.split('/').pop();
                                return `/api/images/${filename}`;
                              }
                              // Assume it's a fileId or filename
                              return `/api/images/${image}`;
                            })();
                            
                            return (
                              <img
                                key={idx}
                                src={imageUrl}
                                alt={`${project.projectName} ${idx + 1}`}
                                className="w-20 h-20 object-cover rounded"
                                onError={(e) => {
                                  console.error('[ProjectList] Failed to load image:', image, 'URL:', imageUrl);
                                  e.target.src = '/placeholder-image.png';
                                }}
                                onLoad={() => {
                                  console.log('[ProjectList] Successfully loaded image:', image, 'URL:', imageUrl);
                                }}
                              />
                            );
                          })}
                          {project.images.length > 3 && (
                            <div className="w-20 h-20 bg-muted rounded flex items-center justify-center text-xs">
                              +{project.images.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onProjectSelect && onProjectSelect(project)}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        View on Map
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProject(project);
                          setShowOfferModal(true);
                        }}
                      >
                        <Tag className="h-4 w-4 mr-1" />
                        Launch Offer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewEngagement(project)}
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Engagement
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {/* Launch Offer Modal */}
      <Dialog open={showOfferModal} onOpenChange={setShowOfferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch Offer for {selectedProject?.projectName}</DialogTitle>
            <DialogDescription>
              Create a promotional offer for this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="offerTitle">Offer Title *</Label>
              <Input
                id="offerTitle"
                value={offerForm.title}
                onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                placeholder="e.g., Early Bird Discount"
              />
            </div>
            <div>
              <Label htmlFor="offerDescription">Description</Label>
              <Input
                id="offerDescription"
                value={offerForm.description}
                onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                placeholder="Offer details..."
              />
            </div>
            <div>
              <Label htmlFor="offerDiscount">Discount (%) *</Label>
              <Input
                id="offerDiscount"
                type="number"
                value={offerForm.discount}
                onChange={(e) => setOfferForm({ ...offerForm, discount: e.target.value })}
                placeholder="e.g., 10"
                min="0"
                max="100"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="offerValidFrom">Valid From *</Label>
                <Input
                  id="offerValidFrom"
                  type="date"
                  value={offerForm.validFrom}
                  onChange={(e) => setOfferForm({ ...offerForm, validFrom: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="offerValidTo">Valid To *</Label>
                <Input
                  id="offerValidTo"
                  type="date"
                  value={offerForm.validTo}
                  onChange={(e) => setOfferForm({ ...offerForm, validTo: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowOfferModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleLaunchOffer} className="flex-1">
                <TrendingUp className="h-4 w-4 mr-2" />
                Launch Offer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Engagement Monitoring Modal */}
      <Dialog open={showEngagementModal} onOpenChange={setShowEngagementModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Engagement Analytics - {selectedProject?.projectName}</DialogTitle>
            <DialogDescription>
              Monitor engagement metrics for this project
            </DialogDescription>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="h-5 w-5 text-blue-500" />
                      <span className="font-semibold">Total Views</span>
                    </div>
                    <div className="text-2xl font-bold">{selectedProject.engagement?.views || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-5 w-5 text-green-500" />
                      <span className="font-semibold">Inquiries</span>
                    </div>
                    <div className="text-2xl font-bold">{selectedProject.engagement?.inquiries || 0}</div>
                  </CardContent>
                </Card>
              </div>
              {selectedProject.territories && selectedProject.territories.length > 0 && (
                <div>
                  <Label>Territories</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedProject.territories.map((pincode, idx) => (
                      <Badge key={idx} variant="outline">
                        {pincode}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedProject.engagement?.lastViewed && (
                <div>
                  <Label>Last Viewed</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedProject.engagement.lastViewed)}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

