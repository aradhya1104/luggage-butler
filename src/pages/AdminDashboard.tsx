import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Luggage, LogOut, Package, Clock, CheckCircle, Truck, RefreshCw, UserPlus, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Booking {
  id: string;
  pickup_location: string;
  delivery_location: string | null;
  pickup_date: string;
  drop_off_date: string;
  number_of_bags: number;
  amount: number;
  status: string;
  tracking_id: string | null;
  created_at: string;
  user_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
}

interface AdminRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  status: string;
  requested_at: string;
}

const statusOptions = [
  { value: "pending", label: "Pending", icon: Clock, color: "bg-yellow-500" },
  { value: "paid", label: "Paid", icon: CheckCircle, color: "bg-blue-500" },
  { value: "in_transit", label: "In Transit", icon: Truck, color: "bg-purple-500" },
  { value: "delivered", label: "Delivered", icon: Package, color: "bg-green-500" },
  { value: "completed", label: "Completed", icon: CheckCircle, color: "bg-green-700" },
];

const SUPER_ADMIN_EMAIL = "aradhya1104tripathi@gmail.com";

const AdminDashboard = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate('/admin');
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      await supabase.auth.signOut();
      navigate('/admin');
      return;
    }

    setCurrentUserEmail(session.user.email || null);
    setIsSuperAdmin(session.user.email === SUPER_ADMIN_EMAIL);
    
    fetchBookings();
    if (session.user.email === SUPER_ADMIN_EMAIL) {
      fetchAdminRequests();
    }
  };

  const fetchAdminRequests = async () => {
    const { data, error } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (!error && data) {
      setAdminRequests(data);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    const { data: bookingsData, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch bookings",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Fetch profiles for all user_ids
    const userIds = [...new Set(bookingsData?.map(b => b.user_id) || [])];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .in('user_id', userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

    const enrichedBookings = bookingsData?.map(booking => ({
      ...booking,
      customer_name: profilesMap.get(booking.user_id)?.full_name || null,
      customer_phone: profilesMap.get(booking.user_id)?.phone || null,
    })) || [];

    setBookings(enrichedBookings);
    setLoading(false);
  };

  const updateStatus = async (bookingId: string, newStatus: string) => {
    setUpdatingId(bookingId);
    
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Order status updated to ${newStatus}`,
      });
      setBookings(prev => 
        prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
      );
    }
    setUpdatingId(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  const handleApproveAdmin = async (request: AdminRequest) => {
    setUpdatingId(request.id);
    
    // Insert admin role for the user
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: request.user_id, role: 'admin' });

    if (roleError) {
      toast({
        title: "Error",
        description: "Failed to approve admin request",
        variant: "destructive",
      });
      setUpdatingId(null);
      return;
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('admin_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', request.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to update request status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Approved",
        description: `${request.email} is now an admin`,
      });
      setAdminRequests(prev => prev.filter(r => r.id !== request.id));
    }
    setUpdatingId(null);
  };

  const handleRejectAdmin = async (request: AdminRequest) => {
    setUpdatingId(request.id);
    
    const { error } = await supabase
      .from('admin_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', request.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Rejected",
        description: `Admin request from ${request.email} rejected`,
      });
      setAdminRequests(prev => prev.filter(r => r.id !== request.id));
    }
    setUpdatingId(null);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = statusOptions.find(s => s.value === status);
    if (!statusConfig) return <Badge variant="outline">{status}</Badge>;
    
    return (
      <Badge className={`${statusConfig.color} text-white`}>
        {statusConfig.label}
      </Badge>
    );
  };

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    inTransit: bookings.filter(b => b.status === 'in_transit').length,
    completed: bookings.filter(b => b.status === 'completed' || b.status === 'delivered').length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Luggage className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Luggo Admin</h1>
              <p className="text-sm text-muted-foreground">Order Management</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Main Content with Tabs */}
        {isSuperAdmin ? (
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="admin-requests" className="relative">
                Admin Requests
                {adminRequests.length > 0 && (
                  <Badge className="ml-2 bg-destructive text-destructive-foreground">
                    {adminRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pending
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-accent">{stats.pending}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      In Transit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-primary">{stats.inTransit}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-secondary-foreground">{stats.completed}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Orders Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>All Orders</CardTitle>
                  <Button variant="outline" size="sm" onClick={fetchBookings}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading orders...
                    </div>
                  ) : bookings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No orders found
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tracking ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Pickup</TableHead>
                            <TableHead>Delivery</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead>Bags</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Update Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookings.map((booking) => (
                            <TableRow key={booking.id}>
                              <TableCell className="font-mono text-sm">
                                {booking.tracking_id || 'N/A'}
                              </TableCell>
                            <TableCell className="min-w-[150px]">
                              <div className="text-sm font-medium">
                                {booking.customer_name || 'N/A'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {booking.customer_phone || 'No phone'}
                              </div>
                            </TableCell>
                              <TableCell className="max-w-[150px] truncate">
                                {booking.pickup_location}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate">
                                {booking.delivery_location || '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div>{format(new Date(booking.drop_off_date), 'dd MMM')}</div>
                                <div className="text-muted-foreground">
                                  to {format(new Date(booking.pickup_date), 'dd MMM')}
                                </div>
                              </TableCell>
                              <TableCell>{booking.number_of_bags}</TableCell>
                              <TableCell>₹{booking.amount}</TableCell>
                              <TableCell>{getStatusBadge(booking.status)}</TableCell>
                              <TableCell>
                                <Select
                                  value={booking.status}
                                  onValueChange={(value) => updateStatus(booking.id, value)}
                                  disabled={updatingId === booking.id}
                                >
                                  <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {statusOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admin-requests">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      Pending Admin Requests
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Approve or reject admin access requests
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchAdminRequests}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {adminRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending admin requests
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Full Name</TableHead>
                            <TableHead>Requested At</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminRequests.map((request) => (
                            <TableRow key={request.id}>
                              <TableCell className="font-medium">{request.email}</TableCell>
                              <TableCell>{request.full_name || '-'}</TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(request.requested_at), 'dd MMM yyyy, HH:mm')}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveAdmin(request)}
                                    disabled={updatingId === request.id}
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRejectAdmin(request)}
                                    disabled={updatingId === request.id}
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {/* Stats Cards - Non super admin view */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-accent">{stats.pending}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    In Transit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">{stats.inTransit}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-secondary-foreground">{stats.completed}</p>
                </CardContent>
              </Card>
            </div>

            {/* Orders Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Orders</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchBookings}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading orders...
                  </div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No orders found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tracking ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Pickup</TableHead>
                          <TableHead>Delivery</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Bags</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Update Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell className="font-mono text-sm">
                              {booking.tracking_id || 'N/A'}
                            </TableCell>
                          <TableCell className="min-w-[150px]">
                            <div className="text-sm font-medium">
                              {booking.customer_name || 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {booking.customer_phone || 'No phone'}
                            </div>
                          </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {booking.pickup_location}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {booking.delivery_location || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div>{format(new Date(booking.drop_off_date), 'dd MMM')}</div>
                              <div className="text-muted-foreground">
                                to {format(new Date(booking.pickup_date), 'dd MMM')}
                              </div>
                            </TableCell>
                            <TableCell>{booking.number_of_bags}</TableCell>
                            <TableCell>₹{booking.amount}</TableCell>
                            <TableCell>{getStatusBadge(booking.status)}</TableCell>
                            <TableCell>
                              <Select
                                value={booking.status}
                                onValueChange={(value) => updateStatus(booking.id, value)}
                                disabled={updatingId === booking.id}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
