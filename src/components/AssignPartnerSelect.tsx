import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Props {
  bookingId: string;
  currentPartnerId: string | null;
  onChange?: (partnerId: string | null) => void;
}

const AssignPartnerSelect = ({ bookingId, currentPartnerId, onChange }: Props) => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<{ id: string; partner_code: string; full_name: string; availability_status: string }[]>([]);
  const [value, setValue] = useState(currentPartnerId ?? "none");

  useEffect(() => {
    supabase
      .from("delivery_partners")
      .select("id, partner_code, full_name, availability_status")
      .eq("account_status", "active")
      .order("full_name")
      .then(({ data }) => setPartners(data ?? []));
  }, []);

  const assign = async (v: string) => {
    const partnerId = v === "none" ? null : v;
    const { error } = await supabase.from("bookings").update({ assigned_partner_id: partnerId }).eq("id", bookingId);
    if (error) {
      toast({ title: "Could not assign partner", description: error.message, variant: "destructive" });
      return;
    }
    setValue(v);
    onChange?.(partnerId);
    toast({ title: partnerId ? "Partner assigned" : "Partner removed" });
  };

  return (
    <Select value={value} onValueChange={assign}>
      <SelectTrigger className="w-full max-w-xs"><SelectValue placeholder="Assign partner" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Not assigned</SelectItem>
        {partners.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.full_name} ({p.partner_code}) · {p.availability_status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default AssignPartnerSelect;
