import { supabase } from "@/integrations/supabase/client";

export const VEHICLE_TYPES = [
  { value: "bike", label: "Bike" },
  { value: "scooter", label: "Scooter" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
  { value: "auto", label: "Auto rickshaw" },
  { value: "other", label: "Other" },
];

export const DOC_TYPES = [
  { value: "driving_licence", label: "Driving licence" },
  { value: "aadhaar", label: "Aadhaar" },
  { value: "pan", label: "PAN card" },
  { value: "vehicle_rc", label: "Vehicle RC" },
  { value: "other", label: "Other" },
];

export const vehicleLabel = (v: string) => VEHICLE_TYPES.find((t) => t.value === v)?.label ?? v;

export const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["active", "verified", "available", "approved"].includes(s)) return "default";
  if (["suspended", "rejected"].includes(s)) return "destructive";
  if (["pending", "busy"].includes(s)) return "secondary";
  return "outline";
};

export const getPhotoUrl = async (path: string | null) => {
  if (!path) return null;
  const { data } = await supabase.storage.from("partner-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
};
