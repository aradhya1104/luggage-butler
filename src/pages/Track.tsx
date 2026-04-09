import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Calendar, Briefcase, Package, Truck, CheckCircle, Clock, Loader2 } from "lucide-react";
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

const statusSteps = [
  { key: "pending", label: "Booking Confirmed", icon: Clock },
  { key: "paid", label: "Payment Received", icon: CheckCircle },
  { key: "in_transit", label: "In Transit", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
  { key: "completed", label: "Completed", icon: CheckCircle },
];

const Track = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [trackingId, setTrackingId] = useState(searchParams.get("id") || "");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setTrackingId(id);
      handleSearch(id);
    }
  }, []);

  const handleSearch = async (id?: string) => {
    const searchId = id || trackingId;
    if (!searchId.trim()) {
      toast({
        title: "Enter Tracking ID",
        description: "Please enter your tracking ID to search",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setSearched(true);

    const { data, error } = await supabase
      .rpc("get_booking_by_tracking_id", { p_tracking_id: searchId.trim().toUpperCase() })
      .single();

    if (error || !data) {
      setBooking(null);
      toast({
        title: "Not Found",
        description: "No booking found with this tracking ID",
        variant: "destructive",
      });
    } else {
      setBooking(data);
      setSearchParams({ id: searchId.trim().toUpperCase() });
    }

    setIsLoading(false);
  };

  const getStatusIndex = (status: string) => {
    const index = statusSteps.findIndex(s => s.key === status);
    return index >= 0 ? index : 0;
  };

  const currentStatusIndex = booking ? getStatusIndex(booking.status) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Track Your Luggage</h1>
          <p className="text-muted-foreground mb-8 text-center">Enter your tracking ID to check status</p>

          {/* Search Box */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter Tracking ID (e.g., LUG-XXXXXXXX)"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="text-lg"
                />
                <Button onClick={() => handleSearch()} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {searched && !isLoading && (
            booking ? (
              <>
                {/* Status Timeline */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Booking Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      {statusSteps.map((step, index) => {
                        const Icon = step.icon;
                        const isCompleted = index <= currentStatusIndex;
                        const isCurrent = index === currentStatusIndex;

                        return (
                          <div key={step.key} className="flex items-center mb-6 last:mb-0">
                            <div className={`
                              w-10 h-10 rounded-full flex items-center justify-center relative z-10
                              ${isCompleted 
                                ? isCurrent 
                                  ? "bg-primary text-primary-foreground" 
                                  : "bg-success text-success-foreground"
                                : "bg-muted text-muted-foreground"
                              }
                            `}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="ml-4 flex-1">
                              <p className={`font-medium ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                                {step.label}
                              </p>
                              {isCurrent && (
                                <p className="text-sm text-primary">Current Status</p>
                              )}
                            </div>
                            {index < statusSteps.length - 1 && (
                              <div className={`
                                absolute left-5 mt-10 w-0.5 h-6 -translate-x-1/2
                                ${index < currentStatusIndex ? "bg-success" : "bg-muted"}
                              `} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Booking Details */}
                <Card>
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
                      <span className="text-muted-foreground">Tracking ID</span>
                      <span className="font-mono font-medium">{booking.tracking_id}</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Booking Found</h3>
                  <p className="text-muted-foreground">
                    Please check your tracking ID and try again
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Track;
