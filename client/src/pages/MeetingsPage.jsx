import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, DollarSign, User, Mail, Building2, X, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';

export default function MeetingsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showArrangeDialog, setShowArrangeDialog] = useState(false);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meetings/broker', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMeetings(data);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load meetings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleArrangeMeeting = (meeting) => {
    setSelectedMeeting(meeting);
    setShowArrangeDialog(true);
    setMeetingDate('');
    setMeetingTime('');
  };

  const handleSubmitArrangement = async () => {
    if (!meetingDate || !meetingTime) {
      toast({
        title: 'Error',
        description: 'Please fill in both date and time',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`/api/meetings/${selectedMeeting._id}/arrange`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingDate, meetingTime }),
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Meeting arranged and emails sent successfully',
        });
        setShowArrangeDialog(false);
        setSelectedMeeting(null);
        fetchMeetings();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.message || 'Failed to arrange meeting',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error arranging meeting:', error);
      toast({
        title: 'Error',
        description: 'Failed to arrange meeting',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRequest = async (meetingId) => {
    if (!confirm('Are you sure you want to remove this meeting request?')) {
      return;
    }

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Meeting request removed successfully',
        });
        fetchMeetings();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.message || 'Failed to remove meeting request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error removing meeting:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove meeting request',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'secondary',
      scheduled: 'default',
      completed: 'default',
      cancelled: 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <DashboardLayout role="broker">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Calendar className="h-8 w-8" />
            Meetings
          </h1>
          <p className="text-muted-foreground">
            Manage meeting requests and arrange property viewings.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Meeting Requests</CardTitle>
            <CardDescription>
              View and manage meeting requests from customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading meetings...</p>
            ) : meetings.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No meeting requests yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.map((meeting) => (
                    <TableRow key={meeting._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{meeting.propertyName}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {meeting.propertyLocation}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {meeting.propertyType} • {meeting.propertyReason === 'sale' ? 'Sale' : 'Lease'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{meeting.customerName}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {meeting.customerEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{meeting.vendorName}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {meeting.vendorEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          ₹{meeting.propertyBudget.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(meeting.status)}
                        {meeting.meetingDate && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(meeting.meetingDate).toLocaleDateString()}
                          </div>
                        )}
                        {meeting.meetingTime && (
                          <div className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {meeting.meetingTime}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {meeting.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleArrangeMeeting(meeting)}
                              >
                                Arrange Meeting
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveRequest(meeting._id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {meeting.status === 'scheduled' && (
                            <Badge variant="default">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Scheduled
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Arrange Meeting Dialog */}
        <Dialog open={showArrangeDialog} onOpenChange={setShowArrangeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Arrange Meeting</DialogTitle>
              <DialogDescription>
                Set the date and time for the property viewing meeting
              </DialogDescription>
            </DialogHeader>
            {selectedMeeting && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-md">
                  <h3 className="font-semibold mb-2">{selectedMeeting.propertyName}</h3>
                  <p className="text-sm text-muted-foreground">
                    Customer: {selectedMeeting.customerName} ({selectedMeeting.customerEmail})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vendor: {selectedMeeting.vendorName} ({selectedMeeting.vendorEmail})
                  </p>
                </div>
                <div>
                  <Label htmlFor="meetingDate">Meeting Date *</Label>
                  <Input
                    id="meetingDate"
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="meetingTime">Meeting Time *</Label>
                  <Input
                    id="meetingTime"
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowArrangeDialog(false);
                      setSelectedMeeting(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitArrangement} className="flex-1">
                    Arrange Meeting
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

