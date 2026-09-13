import { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair, Loader2, LocateFixed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  showCurrentLocationButton?: boolean;
}

interface Suggestion {
  placeId: string;
  text: string;
}

const LocationInput = ({ label, placeholder, value, onChange, optional, showCurrentLocationButton = false }: LocationInputProps) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const skipAutocompleteRef = useRef(false);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced Google Places autocomplete
  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsFetchingSuggestions(true);
      try {
        const { data, error } = await supabase.functions.invoke("places-autocomplete", {
          body: { input: query, sessionToken: sessionTokenRef.current },
        });
        if (error) throw error;
        const list: Suggestion[] = data?.suggestions ?? [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (suggestion: Suggestion) => {
    skipAutocompleteRef.current = true;
    onChange(suggestion.text);
    setSuggestions([]);
    setShowSuggestions(false);
    // Retire session token after a selection
    sessionTokenRef.current = crypto.randomUUID();
  };

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
          const { data, error } = await supabase.functions.invoke(
            "reverse-geocode",
            {
              body: { latitude, longitude },
            }
          );

          if (error) {
            throw new Error(error.message || "Geocoding failed");
          }

          skipAutocompleteRef.current = true;
          if (data?.address) {
            onChange(data.address);
          } else {
            onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        } catch {
          // Fallback to coordinates if reverse geocoding fails
          skipAutocompleteRef.current = true;
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
      <div className="relative" ref={wrapperRef}>
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          autoComplete="off"
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

        {showSuggestions && (
          <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-accent/10 transition-colors flex items-start gap-2"
                  onClick={() => selectSuggestion(s)}
                >
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>{s.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {isFetchingSuggestions && (
        <p className="text-xs text-muted-foreground">Searching addresses...</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {showCurrentLocationButton && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={detectLocation}
          disabled={isDetecting}
          className="w-full"
        >
          {isDetecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
          {isDetecting ? "Detecting location..." : "Use my current location"}
        </Button>
      )}
    </div>
  );
};

export default LocationInput;
