import { Banknote, ExternalLink, MapPin, Navigation, Package, Phone, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import BookingHandover from "@/components/BookingHandover";

export type PartnerJob = Pick<Tables<"bookings">, "id" | "tracking_id" | "pickup_location" | "delivery_location" | "pickup_date" | "pickup_time" | "drop_off_date" | "delivery_time" | "status" | "number_of_bags" | "amount"> & Partial<Pick<Tables<"bookings">, "pickup_latitude" | "pickup_longitude" | "delivery_latitude" | "delivery_longitude">> & { customer_name?: string | null; customer_phone?: string | null };

const labels: Record<string, string> = {
  pending: "Pending", cod_pending: "Cash on delivery", paid: "Ready for pickup",
  in_storage: "In storage", in_transit: "Out for delivery", delivered: "Delivered",
  picked_up: "Picked Up",
  completed: "Completed", cancelled: "Cancelled",
};

const schedule = (date: string, time: string | null) => {
  const value = new Date(`${date}T00:00:00`);
  return `${Number.isNaN(value.getTime()) ? date : format(value, "dd MMM yyyy")}${time ? ` at ${time.slice(0, 5)}` : ""}`;
};

const mapsUrl = (address: string, lat?: number | null, lng?: number | null) =>
  lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const directionsUrl = (address: string, lat?: number | null, lng?: number | null) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address)}`;

export default function PartnerJobCard({ job }: { job: PartnerJob }) {
  const delivery = job.status === "in_transit";

  return (
    <article className="rounded-lg border border-accent bg-card p-5 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase text-accent"><Zap className="h-3 w-3" />Assigned job</span>
        <span className="rounded-full bg-primary/5 px-2.5 py-1 text-[10px] font-semibold text-primary">{labels[job.status] ?? job.status.replace(/_/g, " ")}</span>
      </div>
      <div>
        <p className="font-mono text-xs text-muted-foreground break-all">Booking #{job.tracking_id ?? job.id.slice(0, 8)}</p>
        <h2 className="mt-1 text-lg font-bold text-foreground">{delivery ? "Luggage delivery" : "Luggage pickup"}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" />{job.number_of_bags} luggage {job.number_of_bags === 1 ? "bag" : "bags"}</p>
      </div>
      {(job.customer_name || job.customer_phone) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-accent">Customer</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground break-words"><User className="h-3.5 w-3.5 shrink-0" />{job.customer_name || "Customer"}</p>
            {job.customer_phone && <p className="mt-0.5 text-xs text-muted-foreground">{job.customer_phone}</p>}
          </div>
          {job.customer_phone && (
            <Button asChild size="sm" variant="accent" className="rounded-lg shrink-0"><a href={`tel:${job.customer_phone.replace(/[^\d+]/g, "")}`}><Phone />Call</a></Button>
          )}
        </div>
      )}
      {job.status === "cod_pending" && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/50 bg-warning/5 p-3">
          <span className="rounded-lg bg-warning p-2 text-warning-foreground"><Banknote className="h-4 w-4" /></span>
          <div><p className="text-[10px] font-bold uppercase text-foreground">Cash on delivery collection</p><p className="text-sm font-bold text-foreground">Collect ₹{job.amount.toLocaleString("en-IN")} from customer</p></div>
        </div>
      )}
      <div className="rounded-lg bg-muted/40 px-3.5 py-3">
        <a href={mapsUrl(job.pickup_location, job.pickup_latitude, job.pickup_longitude)} target="_blank" rel="noopener noreferrer" className="block pb-3 rounded-md hover:bg-muted transition-colors" aria-label="Open pickup address in Google Maps">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-accent"><MapPin className="h-3 w-3" />Pickup address<ExternalLink className="h-3 w-3 ml-auto" /></p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-foreground break-words underline decoration-dotted underline-offset-2">{job.pickup_location}</p>
          <p className="mt-1 text-xs text-muted-foreground">{schedule(job.pickup_date, job.pickup_time)}</p>
        </a>
        <a href={job.delivery_location ? mapsUrl(job.delivery_location, job.delivery_latitude, job.delivery_longitude) : mapsUrl(job.pickup_location, job.pickup_latitude, job.pickup_longitude)} target="_blank" rel="noopener noreferrer" className="block border-t border-border/60 pt-3 rounded-md hover:bg-muted transition-colors" aria-label="Open delivery address in Google Maps">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-foreground"><MapPin className="h-3 w-3" />Delivery address<ExternalLink className="h-3 w-3 ml-auto" /></p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-foreground break-words underline decoration-dotted underline-offset-2">{job.delivery_location || "Return to pickup location"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{schedule(job.drop_off_date, job.delivery_time)}</p>
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild className="rounded-lg bg-admin text-admin-foreground hover:bg-admin-soft text-xs px-2"><a href={directionsUrl(job.pickup_location, job.pickup_latitude, job.pickup_longitude)} target="_blank" rel="noopener noreferrer"><MapPin className="text-accent" />Navigate to Pickup</a></Button>
        <Button asChild variant="accent" className="rounded-lg text-xs px-2"><a href={job.delivery_location ? directionsUrl(job.delivery_location, job.delivery_latitude, job.delivery_longitude) : directionsUrl(job.pickup_location, job.pickup_latitude, job.pickup_longitude)} target="_blank" rel="noopener noreferrer"><Navigation />Navigate to Drop-off</a></Button>
      </div>
      <BookingHandover bookingId={job.id} role="partner" />
    </article>
  );
}