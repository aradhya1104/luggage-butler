import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, MapPin, Calendar, Briefcase, CreditCard, Loader2, User, Phone, Mail, Banknote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface UserProfile {
  full_name: string | null;
  phone: string | null;
  email: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PRICING: Record<number, number> = {
  1: 300,
  2: 500,
  3: 800,
};

function getPrice(bags: number): number {
  if (bags >= 4) return 1200;
  return PRICING[bags] || 300;
}

const Booking = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  const pickupLocation = searchParams.get("pickup") || "";
  const deliveryLocation = searchParams.get("delivery") || "";
  const dropOffDate = searchParams.get("dropOff") || "";
  const pickupDate = searchParams.get("pickupDate") || "";
  const numberOfBags = parseInt(searchParams.get("bags") || "1");

  const amount = getPrice(numberOfBags);

  const hasPhone = !!(userProfile?.phone);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setCheckingAuth(false);
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', session.user.id)
          .single();
        
        setUserProfile({
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          email: session.user.email || '',
        });
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthenticated(!!session);
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', session.user.id)
          .single();
        
        setUserProfile({
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          email: session.user.email || '',
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSavePhone = async () => {
    const trimmed = phoneInput.trim();
    if (!trimmed || trimmed.length < 10) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid phone number (at least 10 digits)",
        variant: "destructive",
      });
      return;
    }

    setSavingPhone(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setSavingPhone(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ phone: trimmed })
      .eq('user_id', session.user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save phone number",
        variant: "destructive",
      });
    } else {
      setUserProfile(prev => prev ? { ...prev, phone: trimmed } : prev);
      toast({
        title: "Saved",
        description: "Phone number saved successfully",
      });
    }
    setSavingPhone(false);
  };

  const openWhatsAppConfirmation = (trackingId: string) => {
    const phone = userProfile?.phone || phoneInput.trim();
    if (!phone) return;

    // Clean phone number - remove spaces, dashes, and add country code if needed
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '91' + cleanPhone; // Default to India country code
    } else {
      cleanPhone = cleanPhone.substring(1); // Remove the +
    }

    const message = encodeURIComponent(
      `✅ *Luggo Booking Confirmed!*\n\n` +
      `📦 Tracking ID: ${trackingId}\n` +
      `📍 Pickup: ${pickupLocation}\n` +
      `${deliveryLocation ? `🏠 Delivery: ${deliveryLocation}\n` : ''}` +
      `📅 Drop-off: ${dropOffDate}\n` +
      `📅 Pickup: ${pickupDate}\n` +
      `🧳 Bags: ${numberOfBags}\n` +
      `💰 Amount: ₹${amount}\n\n` +
      `Track your luggage at: ${window.location.origin}/track?id=${trackingId}`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handlePayment = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to continue with booking",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!hasPhone) {
      toast({
        title: "Phone Required",
        description: "Please add your phone number to proceed",
        variant: "destructive",
      });
      return;
    }

    if (!pickupLocation || !dropOffDate || !pickupDate) {
      toast({
        title: "Missing Details",
        description: "Please go back and fill all required details",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
        body: {
          action: "create-order",
          pickupLocation,
          deliveryLocation,
          dropOffDate,
          pickupDate,
          numberOfBags,
        },
      });

      if (error) throw error;

      const options = {
        key: data.keyId,
        amount: data.amount * 100,
        currency: data.currency,
        name: "LuggageStore",
        description: `Luggage Storage - ${numberOfBags} bag(s)`,
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            const verifyResult = await supabase.functions.invoke("create-razorpay-order", {
              body: {
                action: "verify-payment",
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                bookingId: data.bookingId,
              },
            });

            if (verifyResult.error) throw verifyResult.error;

            toast({
              title: "Payment Successful!",
              description: "Your booking has been confirmed",
            });

            // Fetch the booking to get tracking ID for WhatsApp
            const { data: bookingData } = await supabase
              .from('bookings')
              .select('tracking_id')
              .eq('id', data.bookingId)
              .single();

            if (bookingData?.tracking_id) {
              openWhatsAppConfirmation(bookingData.tracking_id);
            }

            navigate(`/receipt/${data.bookingId}`);
          } catch (err) {
            console.error("Verification error:", err);
            toast({
              title: "Payment Verification Failed",
              description: "Please contact support",
              variant: "destructive",
            });
          }
        },
        prefill: {
          email: userProfile?.email || "",
          contact: userProfile?.phone || "",
        },
        theme: {
          color: "#F97316",
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Error",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-24">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Booking Summary</h1>
          <p className="text-muted-foreground mb-8">Review your booking details before payment</p>

          {/* Customer Details Card */}
          {userProfile && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
                <CardDescription>Your contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{userProfile.full_name || "Not provided"}</p>
                  </div>
                </div>

                {hasPhone ? (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone Number</p>
                      <p className="font-medium">{userProfile.phone}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-destructive mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="phone" className="text-sm text-destructive font-medium">
                        Phone Number (Required)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Enter your phone number"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="max-w-[250px]"
                          maxLength={15}
                        />
                        <Button
                          size="sm"
                          onClick={handleSavePhone}
                          disabled={savingPhone || !phoneInput.trim()}
                        >
                          {savingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Required to proceed. You'll receive booking confirmation on WhatsApp.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{userProfile.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
              <CardDescription>Your luggage storage reservation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Pickup Location</p>
                  <p className="font-medium">{pickupLocation || "Not specified"}</p>
                </div>
              </div>

              {deliveryLocation && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-accent mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Delivery Location</p>
                    <p className="font-medium">{deliveryLocation}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Drop-off Date</p>
                      <p className="font-medium">{dropOffDate || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pickup Date</p>
                      <p className="font-medium">{pickupDate || "Not specified"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Number of Bags</p>
                  <p className="font-medium">{numberOfBags} {numberOfBags === 1 ? "Bag" : "Bags"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Price Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Storage ({numberOfBags} {numberOfBags === 1 ? "bag" : "bags"})
                  </span>
                  <span>₹{amount}</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-semibold text-lg">
                  <span>Total Amount</span>
                  <span className="text-primary">₹{amount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Button
                variant="hero"
                size="xl"
                className="w-full"
                onClick={handlePayment}
                disabled={isLoading || !hasPhone}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay ₹{amount} with Razorpay
                  </>
                )}
              </Button>
              {!hasPhone && (
                <p className="text-center text-sm text-destructive mt-2">
                  Please add your phone number above to proceed
                </p>
              )}
              <p className="text-center text-sm text-muted-foreground mt-4">
                Secure payment powered by Razorpay. UPI, Cards, Net Banking accepted.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Booking;
