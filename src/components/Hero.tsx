import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Shield, Clock, Truck } from "lucide-react";
import heroImage from "@/assets/hero-luggage.jpg";
import LocationInput from "./LocationInput";
import { useToast } from "@/hooks/use-toast";

const Hero = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pickupLocation, setPickupLocation] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [dropOffDate, setDropOffDate] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [numberOfBags, setNumberOfBags] = useState("1");

  const handleGetQuote = () => {
    if (!pickupLocation.trim() || !pickupDate || !dropOffDate) {
      toast({
        title: "Missing details",
        description: "Please fill pickup location, pickup date and drop-off date.",
        variant: "destructive",
      });
      return;
    }
    const params = new URLSearchParams({
      pickup: pickupLocation,
      delivery: deliveryLocation,
      dropOff: dropOffDate,
      pickupDate: pickupDate,
      bags: numberOfBags.replace(/\D/g, "") || "1",
    });
    navigate(`/booking?${params.toString()}`);
  };

  const scrollToBookingForm = () => {
    const el = document.getElementById("quick-booking");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="relative min-h-screen pt-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      
      <div className="container relative mx-auto px-4 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full text-accent font-medium text-sm">
              <Shield className="w-4 h-4" />
              Trusted by 50,000+ travelers
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Store Your Luggage,{" "}
              <span className="text-accent">Explore Freely</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
              Secure luggage storage with pickup and delivery anywhere in the city. 
              Drop your bags, we'll take care of them until you need them back.
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-success" />
                </div>
                <span>Fully Insured</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <span>24/7 Access</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-accent" />
                </div>
                <span>City-wide Delivery</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="xl" onClick={scrollToBookingForm}>
                Book Storage Now
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="xl" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                Learn More
              </Button>
            </div>
          </div>

          {/* Right - Booking Card */}
          <div className="relative animate-slide-in-right" style={{ animationDelay: "0.2s" }}>
            <div id="quick-booking" className="bg-card rounded-2xl shadow-xl p-6 md:p-8 border border-border scroll-mt-24">
              <h3 className="text-xl font-semibold text-foreground mb-6">
                Quick Booking
              </h3>
              
              <div className="space-y-4">
                {/* Pickup Location */}
                <LocationInput
                  label="Pickup Location"
                  placeholder="Enter pickup address"
                  value={pickupLocation}
                  onChange={setPickupLocation}
                  showCurrentLocationButton
                />

                {/* Drop-off Location */}
                <LocationInput
                  label="Delivery Location"
                  placeholder="Where should we deliver?"
                  value={deliveryLocation}
                  onChange={setDeliveryLocation}
                  optional
                />

                {/* Date Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Pickup Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={pickupDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          const today = new Date().toISOString().split("T")[0];
                          if (val && val < today) return;
                          setPickupDate(val);
                          if (dropOffDate && val && dropOffDate < val) {
                            setDropOffDate("");
                          }
                        }}
                        className="w-full pl-11 pr-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Drop-off Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="date"
                        min={pickupDate || new Date().toISOString().split("T")[0]}
                        value={dropOffDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          const minDate = pickupDate || new Date().toISOString().split("T")[0];
                          if (val && val < minDate) return;
                          setDropOffDate(val);
                        }}
                        className="w-full pl-11 pr-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Number of Bags */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Number of Bags</label>
                  <select 
                    value={numberOfBags}
                    onChange={(e) => setNumberOfBags(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  >
                  <option value="1">1 Bag - ₹300</option>
                    <option value="2">2 Bags - ₹500</option>
                    <option value="3">3 Bags - ₹800</option>
                    <option value="4">4+ Bags - ₹1,200</option>
                  </select>
                </div>

                {/* Submit Button */}
                <Button variant="hero" size="lg" className="w-full mt-4" onClick={handleGetQuote}>
                  Get Quote
                  <ArrowRight className="w-5 h-5" />
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Starting from ₹300 per booking
                </p>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-accent/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
