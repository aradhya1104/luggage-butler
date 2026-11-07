import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordinates } from "@/lib/location";

interface Props {
  point: Coordinates;
  onChange: (point: Coordinates) => void;
}

export default function PickupLocationMap({ point, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current).setView([point.latitude, point.longitude], 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(instance);
    const pin = L.marker([point.latitude, point.longitude], {
      draggable: true,
      icon: L.divIcon({ className: "pickup-map-pin", html: '<span aria-hidden="true">●</span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
    }).addTo(instance);
    pin.on("dragend", () => {
      const p = pin.getLatLng();
      change.current({ latitude: p.lat, longitude: p.lng });
    });
    instance.on("click", (event: L.LeafletMouseEvent) => {
      change.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });
    map.current = instance;
    marker.current = pin;
    return () => { instance.remove(); map.current = null; marker.current = null; };
    // The map is created once; subsequent coordinate changes move the pin below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    marker.current?.setLatLng([point.latitude, point.longitude]);
    map.current?.panTo([point.latitude, point.longitude]);
  }, [point.latitude, point.longitude]);

  return <div ref={container} aria-label="Pickup location map" className="relative z-0 h-56 w-full rounded-lg border border-border [&_.pickup-map-pin]:text-accent [&_.pickup-map-pin]:text-3xl" />;
}