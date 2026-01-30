import { useState } from "react";
import { MapPin, Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}

const LocationInput = ({ label, placeholder, value, onChange, optional }: LocationInputProps) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsDetecting(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Use reverse geocoding to get address
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          
          if (data.display_name) {
            onChange(data.display_name);
          } else {
            onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        } catch {
          // Fallback to coordinates if reverse geocoding fails
          onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
        
        setIsDetecting(false);
      },
      (err) => {
        setIsDetecting(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Please allow location access to detect your location");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location information is unavailable");
            break;
          case err.TIMEOUT:
            setError("Location detection timed out");
            break;
          default:
            setError("An error occurred while detecting location");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {optional && <span className="text-muted-foreground ml-1">(Optional)</span>}
      </label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-12 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-accent"
          onClick={detectLocation}
          disabled={isDetecting}
          title="Detect current location"
        >
          {isDetecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
};

export default LocationInput;
