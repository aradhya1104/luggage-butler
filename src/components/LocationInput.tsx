import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, LocateFixed, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PickupLocationMap from "./PickupLocationMap";
import { GPS_OPTIONS, googleMapsLocationUrl, parsePhotonResults, photonSearchUrl, validCoordinates, type Coordinates, type PlaceSuggestion } from "@/lib/location";

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  showCurrentLocationButton?: boolean;
  coordinates?: Coordinates | null;
  onCoordinatesChange?: (point: Coordinates | null) => void;
  /** Show OpenStreetMap (Photon) address suggestions while typing. */
  enableSearch?: boolean;
  /** Point to rank nearby suggestions first when the customer's own GPS isn't known. */
  biasPoint?: Coordinates | null;
}

const LocationInput = ({ label, placeholder, value, onChange, optional, showCurrentLocationButton = false, coordinates, onCoordinatesChange, enableSearch = false, biasPoint }: LocationInputProps) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState<Coordinates | null>(coordinates ?? null);
  const [confirmed, setConfirmed] = useState(Boolean(coordinates));
  const [latitude, setLatitude] = useState(coordinates ? String(coordinates.latitude) : "");
  const [longitude, setLongitude] = useState(coordinates ? String(coordinates.longitude) : "");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [gpsBias, setGpsBias] = useState<Coordinates | null>(null);
  const skipSearch = useRef(false);

  useEffect(() => {
    if (!enableSearch || !navigator.geolocation || !navigator.permissions?.query) return;
    // Only bias silently when location permission was already granted; never prompt on load.
    navigator.permissions.query({ name: "geolocation" as PermissionName }).then(status => {
      if (status.state === "granted") navigator.geolocation.getCurrentPosition(
        pos => setGpsBias({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }), () => {}, { maximumAge: 300000, timeout: 10000 });
    }).catch(() => {});
  }, [enableSearch]);

  useEffect(() => {
    if (!enableSearch) return;
    if (skipSearch.current) { skipSearch.current = false; return; }
    const q = value.trim();
    if (q.length < 3) { setSuggestions([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(photonSearchUrl(q, gpsBias ?? biasPoint ?? point), { signal: controller.signal });
        if (!res.ok) throw new Error("search failed");
        setSuggestions(parsePhotonResults(await res.json()));
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enableSearch]);

  const choose = (s: PlaceSuggestion) => {
    skipSearch.current = true;
    onChange(s.label);
    setOpen(false);
    setSuggestions([]);
    setAccuracy(null);
    adjustPoint(s.point);
  };

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
        <Input id={id} value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }} placeholder={placeholder} autoComplete={enableSearch ? "off" : "street-address"} role={enableSearch ? "combobox" : undefined} aria-expanded={enableSearch ? open && suggestions.length > 0 : undefined} aria-controls={enableSearch ? `${id}-suggestions` : undefined} className="pl-11 pr-10 h-12" />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        {enableSearch && open && suggestions.length > 0 && <ul id={`${id}-suggestions`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {suggestions.map(s => <li key={s.id} role="option" aria-selected={false}>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(s)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span><span className="block text-sm font-medium">{s.name}</span>{s.detail && <span className="block text-xs text-muted-foreground">{s.detail}</span>}</span>
            </button>
          </li>)}
          <li className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border">Search by Photon · Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors</li>
        </ul>}
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
