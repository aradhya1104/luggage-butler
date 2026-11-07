import { useState } from "react";
import { MapPin, Loader2, LocateFixed, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PickupLocationMap from "./PickupLocationMap";
import { GPS_OPTIONS, googleMapsLocationUrl, validCoordinates, type Coordinates } from "@/lib/location";

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  showCurrentLocationButton?: boolean;
  coordinates?: Coordinates | null;
  onCoordinatesChange?: (point: Coordinates | null) => void;
}

const LocationInput = ({ label, placeholder, value, onChange, optional, showCurrentLocationButton = false, coordinates, onCoordinatesChange }: LocationInputProps) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState<Coordinates | null>(coordinates ?? null);
  const [confirmed, setConfirmed] = useState(Boolean(coordinates));
  const [latitude, setLatitude] = useState(coordinates ? String(coordinates.latitude) : "");
  const [longitude, setLongitude] = useState(coordinates ? String(coordinates.longitude) : "");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const id = label.toLowerCase().replace(/\s+/g, "-");

  const adjustPoint = (next: Coordinates) => {
    if (!validCoordinates(next)) return;
    setPoint(next);
    setLatitude(String(next.latitude));
    setLongitude(String(next.longitude));
    setConfirmed(false);
    onCoordinatesChange?.(null);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) { setError("Your browser does not support location access. Enter your address instead."); return; }
    setIsDetecting(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(position => {
      adjustPoint({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setAccuracy(position.coords.accuracy);
      setIsDetecting(false);
    }, err => {
      setIsDetecting(false);
      setError(err.code === 1 ? "Allow location access, or enter your address manually." : err.code === 3 ? "Location timed out. Try again or enter your address." : "Location is unavailable. Try again or enter your address.");
    }, GPS_OPTIONS);
  };

  const editCoordinate = (axis: "latitude" | "longitude", text: string) => {
    if (axis === "latitude") setLatitude(text); else setLongitude(text);
    setConfirmed(false);
    onCoordinatesChange?.(null);
    const lat = axis === "latitude" ? text : latitude;
    const lng = axis === "longitude" ? text : longitude;
    const next = { latitude: Number(lat), longitude: Number(lng) };
    if (lat.trim() && lng.trim() && validCoordinates(next)) setPoint(next);
  };
  const enteredPoint = { latitude: Number(latitude), longitude: Number(longitude) };
  const canConfirm = Boolean(latitude.trim() && longitude.trim() && validCoordinates(enteredPoint));

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}{optional && <span className="text-muted-foreground ml-1">(Optional)</span>}</label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="street-address" className="pl-11 h-12" />
      </div>
      {showCurrentLocationButton && <Button type="button" variant="outline" size="sm" onClick={detectLocation} disabled={isDetecting} className="w-full">
        {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
        {isDetecting ? "Detecting location..." : "Use my current location"}
      </Button>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {point && <div className="space-y-3">
        <PickupLocationMap point={point} onChange={adjustPoint} />
        {accuracy !== null && <p className="text-xs text-muted-foreground">GPS accuracy: ±{Math.round(accuracy)} m</p>}
        <div className="grid grid-cols-2 gap-2">
          <div><label htmlFor={`${id}-lat`} className="text-xs text-muted-foreground">Latitude</label><Input id={`${id}-lat`} type="number" step="any" min={-90} max={90} value={latitude} onChange={e => editCoordinate("latitude", e.target.value)} /></div>
          <div><label htmlFor={`${id}-lng`} className="text-xs text-muted-foreground">Longitude</label><Input id={`${id}-lng`} type="number" step="any" min={-180} max={180} value={longitude} onChange={e => editCoordinate("longitude", e.target.value)} /></div>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full"><a href={googleMapsLocationUrl(point)} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" />Verify in Google Maps</a></Button>
        <Button type="button" variant={confirmed ? "outline" : "default"} size="sm" className="w-full" disabled={!canConfirm || confirmed} onClick={() => {
          setPoint(enteredPoint);
          setConfirmed(true);
          onCoordinatesChange?.(enteredPoint);
          if (!value.trim()) onChange(`${enteredPoint.latitude.toFixed(6)}, ${enteredPoint.longitude.toFixed(6)}`);
        }}><Check className="w-4 h-4" />{confirmed ? "Location confirmed" : "Confirm location"}</Button>
      </div>}
    </div>
  );
};
export default LocationInput;
