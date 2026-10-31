import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bike, Check, Loader2, UserCheck, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPhotoUrl, vehicleLabel } from "@/lib/partners";

interface PartnerRow {
  id: string;
  partner_code: string;
  full_name: string;
  photo_path: string | null;
  vehicle_type: string;
  vehicle_number: string;
  availability_status: string;
}

interface Props {
  bookingId: string;
  bookingLabel: string;
  currentPartnerId: string | null;
  onClose: () => void;
  onAssigned: (partnerId: string | null) => void;
}

const DispatchPartnerModal = ({ bookingId, bookingLabel, currentPartnerId, onClose, onAssigned }: Props) => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("delivery_partners")
        .select("id, partner_code, full_name, photo_path, vehicle_type, vehicle_number, availability_status")
        .eq("account_status", "active")
        .order("full_name");
      const list = data ?? [];
      setPartners(list);
      const urls: Record<string, string> = {};
      await Promise.all(
        list.map(async (p) => {
          const u = await getPhotoUrl(p.photo_path);
          if (u) urls[p.id] = u;
        })
      );
      setPhotos(urls);
      setLoading(false);
    })();
  }, []);

  const assign = async (partnerId: string) => {
    setBusyId(partnerId);
    const { error } = await supabase
      .from("bookings")
      .update({ assigned_partner_id: partnerId })
      .eq("id", bookingId);
    setBusyId(null);
    if (error) {
      toast({ title: "Could not assign partner", description: error.message, variant: "destructive" });
      return;
    }
    setDoneId(partnerId);
    onAssigned(partnerId);
    setTimeout(onClose, 900);
  };

  const remove = async () => {
    setBusyId("none");
    const { error } = await supabase
      .from("bookings")
      .update({ assigned_partner_id: null })
      .eq("id", bookingId);
    setBusyId(null);
    if (error) {
      toast({ title: "Could not remove partner", description: error.message, variant: "destructive" });
      return;
    }
    onAssigned(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-background w-full max-w-xl rounded-2xl border border-border shadow-2xl relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="p-6 pb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
            Dispatch control
          </p>
          <h3 className="text-xl font-bold text-foreground">Assign delivery partner</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select an active partner for booking <span className="font-mono font-medium text-foreground">{bookingLabel}</span>.
          </p>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
          ) : partners.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No active delivery partners available. Approve pending partner applications first.
            </p>
          ) : (
            partners.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-border flex items-center justify-between gap-3 bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-11 w-11">
                    {photos[p.id] && <AvatarImage src={photos[p.id]} alt={p.full_name} />}
                    <AvatarFallback>{p.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{p.full_name}</span>
                      <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {p.partner_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <Bike className="w-3.5 h-3.5" />
                      <span>{vehicleLabel(p.vehicle_type)} ({p.vehicle_number})</span>
                      <Badge variant={p.availability_status === "available" ? "default" : "secondary"} className="capitalize text-[10px]">
                        {p.availability_status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button size="sm" onClick={() => assign(p.id)} disabled={busyId !== null || doneId === p.id}>
                  {busyId === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : doneId === p.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 mr-1" /> Assign
                    </>
                  )}
                </Button>
              </div>
            ))
          )}

          {currentPartnerId && !loading && (
            <Button variant="outline" className="w-full" onClick={remove} disabled={busyId !== null}>
              Remove assigned partner
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DispatchPartnerModal;
