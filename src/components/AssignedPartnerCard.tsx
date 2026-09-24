import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Phone, Truck } from "lucide-react";
import { getPhotoUrl, vehicleLabel } from "@/lib/partners";

interface PartnerInfo {
  partner_code: string;
  full_name: string;
  photo_path: string | null;
  vehicle_type: string;
  vehicle_number: string;
  mobile: string;
}

const AssignedPartnerCard = ({ bookingId }: { bookingId: string }) => {
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_booking_partner", { p_booking_id: bookingId }).then(async ({ data }) => {
      const p = (data as PartnerInfo[] | null)?.[0];
      if (p) {
        setPartner(p);
        setPhoto(await getPhotoUrl(p.photo_path));
      }
    });
  }, [bookingId]);

  if (!partner) return null;

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 flex items-center gap-3">
      <Avatar className="h-11 w-11">
        {photo && <AvatarImage src={photo} alt={partner.full_name} />}
        <AvatarFallback>{partner.full_name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">Your delivery partner</p>
        <p className="font-medium text-foreground truncate">{partner.full_name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
          <span className="font-mono">{partner.partner_code}</span> ·
          <Truck className="h-3 w-3" /> {vehicleLabel(partner.vehicle_type)} · {partner.vehicle_number}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <a href={`tel:${partner.mobile.replace(/[^0-9+]/g, "")}`}>
          <Phone className="h-4 w-4 mr-1" /> Call
        </a>
      </Button>
    </div>
  );
};

export default AssignedPartnerCard;
