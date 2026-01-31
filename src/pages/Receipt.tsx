import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, MapPin, Calendar, Briefcase, Copy, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface Booking {
  id: string;
  pickup_location: string;
  delivery_location: string | null;
  drop_off_date: string;
  pickup_date: string;
  number_of_bags: number;
  amount: number;
  status: string;
  tracking_id: string;
  created_at: string;
}

const Receipt = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) return;

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (error) {
        console.error("Error fetching booking:", error);
        toast({
          title: "Error",
          description: "Failed to load booking details",
          variant: "destructive",
        });
      } else {
        setBooking(data);
      }
      setIsLoading(false);
    };

    fetchBooking();
  }, [bookingId, toast]);

  const copyTrackingId = () => {
    if (booking?.tracking_id) {
      navigator.clipboard.writeText(booking.tracking_id);
      toast({
        title: "Copied!",
        description: "Tracking ID copied to clipboard",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Booking Not Found</h1>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto">
          {/* Success Banner */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-4">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground">Your booking has been confirmed</p>
          </div>

          {/* Tracking ID Card */}
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Your Tracking ID</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold text-primary tracking-wider">
                    {booking.tracking_id}
                  </span>
                  <Button variant="ghost" size="icon" onClick={copyTrackingId}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Save this ID to track your luggage
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Booking Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Pickup Location</p>
                  <p className="font-medium">{booking.pickup_location}</p>
                </div>
              </div>

              {booking.delivery_location && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-accent mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Delivery Location</p>
                    <p className="font-medium">{booking.delivery_location}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Drop-off Date</p>
                      <p className="font-medium">{booking.drop_off_date}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pickup Date</p>
                      <p className="font-medium">{booking.pickup_date}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Number of Bags</p>
                  <p className="font-medium">{booking.number_of_bags} {booking.number_of_bags === 1 ? "Bag" : "Bags"}</p>
                </div>
              </div>

              <div className="border-t pt-4 flex justify-between">
                <span className="font-medium">Amount Paid</span>
                <span className="text-xl font-bold text-primary">₹{booking.amount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              variant="hero"
              size="lg"
              className="flex-1"
              onClick={() => navigate(`/track?id=${booking.tracking_id}`)}
            >
              Track Your Luggage
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => navigate("/")}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
