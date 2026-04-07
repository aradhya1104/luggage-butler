import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Package, Clock } from "lucide-react";

const TrackingSection = () => {
  const [trackingId, setTrackingId] = useState("");
  const navigate = useNavigate();

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingId.trim()) {
      navigate(`/track?id=${encodeURIComponent(trackingId.trim())}`);
    }
  };

  return (
    <section id="tracking" className="py-20 md:py-28 bg-card">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-4 py-1.5 bg-accent/10 text-accent rounded-full text-sm font-medium mb-4">
            Real-Time Tracking
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Track Your Luggage
          </h2>
          <p className="text-lg text-muted-foreground">
            Enter your tracking ID to see the current status and location of your luggage.
          </p>
        </div>

        {/* Tracking Form */}
        <div className="max-w-xl mx-auto mb-16">
          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter tracking ID (e.g., LUG-XXXXXXXX)"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                className="pl-12 h-14 text-base rounded-xl border-border focus:border-accent"
              />
            </div>
            <Button type="submit" variant="accent" size="lg" className="h-14 px-8 w-full sm:w-auto">
              Track
            </Button>
          </form>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6 rounded-2xl bg-background border border-border">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-7 h-7 text-accent" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Live Location</h3>
            <p className="text-sm text-muted-foreground">
              See exactly where your luggage is at any moment
            </p>
          </div>
          
          <div className="text-center p-6 rounded-2xl bg-background border border-border">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-accent" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Status Updates</h3>
            <p className="text-sm text-muted-foreground">
              Get notified when your luggage status changes
            </p>
          </div>
          
          <div className="text-center p-6 rounded-2xl bg-background border border-border">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-accent" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">ETA Estimates</h3>
            <p className="text-sm text-muted-foreground">
              Know when to expect your luggage delivery
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrackingSection;
