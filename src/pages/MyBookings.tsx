import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, MapPin, Calendar, Loader2, Luggage } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";

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
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  cod_pending: { label: "COD Pending", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  in_transit: { label: "In Transit", variant: "default" },
  delivered: { label: "Delivered", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setBookings(data);
      }
      setLoading(false);
    };

    checkAuthAndFetch();
  }, [navigate]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatus = (status: string) => {
    return statusConfig[status] || { label: status, variant: "outline" as const };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Luggage className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">No bookings yet</p>
              <p className="text-muted-foreground mt-1">Your bookings will appear here once you make one.</p>
              <Button className="mt-6" onClick={() => navigate("/booking")}>
                Book Now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const status = getStatus(booking.status);
              return (
                <Card key={booking.id} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-mono text-muted-foreground">
                          {booking.tracking_id || "—"}
                        </span>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-foreground font-medium">{booking.pickup_location}</p>
                          {booking.delivery_location && (
                            <p className="text-muted-foreground">→ {booking.delivery_location}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-foreground">
                          {formatDate(booking.pickup_date)} — {formatDate(booking.drop_off_date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        {booking.number_of_bags} bag{booking.number_of_bags > 1 ? "s" : ""} · ₹{booking.amount}
                      </div>
                      {booking.tracking_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/track?id=${booking.tracking_id}`)}
                        >
                          Track
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
