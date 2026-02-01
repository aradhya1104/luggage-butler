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
import { Luggage, LogOut, Package, Clock, CheckCircle, Truck, RefreshCw } from "lucide-react";
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
}

const statusOptions = [
  { value: "pending", label: "Pending", icon: Clock, color: "bg-yellow-500" },
  { value: "paid", label: "Paid", icon: CheckCircle, color: "bg-blue-500" },
  { value: "in_transit", label: "In Transit", icon: Truck, color: "bg-purple-500" },
  { value: "delivered", label: "Delivered", icon: Package, color: "bg-green-500" },
  { value: "completed", label: "Completed", icon: CheckCircle, color: "bg-green-700" },
];

const AdminDashboard = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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

    fetchBookings();
  };

  const fetchBookings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch bookings",
        variant: "destructive",
      });
    } else {
      setBookings(data || []);
    }
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
      </main>
    </div>
  );
};

export default AdminDashboard;
