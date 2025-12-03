import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function AddSuperAdminModal({ onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'dataadmin',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Submitting admin creation form:', { name: formData.name, email: formData.email, role: formData.role });
      
      const response = await fetch('/api/superadmin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include', // Include session cookies
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        toast({
          title: 'Success',
          description: data.message || 'Admin created successfully',
        });
        // Reset form
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'dataadmin',
        });
        onClose();
      } else {
        console.error('Error response:', data);
        toast({
          title: 'Error',
          description: data.message || 'Failed to create admin',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Add Admin</h2>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-modal">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-name"
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              data-testid="input-email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
              data-testid="input-password"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Minimum 6 characters. Password will be encrypted securely.
            </p>
          </div>
          <div>
            <Label htmlFor="role">Admin Type *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Select admin type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dataadmin">Data Admin</SelectItem>
                <SelectItem value="salesadmin">Sales Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              Data Admin: Manages users and system data. Sales Admin: Manages projects and sales territories.
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel" disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" data-testid="button-assign-role" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Admin'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
