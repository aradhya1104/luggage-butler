import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PendingPartner {
  id: string;
  partner_code: string;
  full_name: string;
  mobile: string;
  vehicle_type: string;
  vehicle_number: string;
  joined_at: string;
}

const PendingPartnerAlerts = () => {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingPartner[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("delivery_partners")
      .select("id, partner_code, full_name, mobile, vehicle_type, vehicle_number, joined_at")
      .eq("account_status", "pending")
      .order("joined_at", { ascending: true });
    setPending(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const review = async (p: PendingPartner, status: "active" | "rejected") => {
    setBusyId(p.id);
    const { error } = await supabase
      .from("delivery_partners")
      .update({ account_status: status })
      .eq("id", p.id);
    setBusyId(null);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: status === "active" ? "Partner approved" : "Partner rejected", description: `${p.full_name} (${p.partner_code})` });
    setPending((prev) => prev.filter((x) => x.id !== p.id));
  };

  if (loading || pending.length === 0) return null;

  return (
    <Card className="border-accent/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="w-5 h-5 text-accent" />
          Delivery partner approvals ({pending.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          New partners are waiting for activation. Approve to let them receive bookings.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((p) => (
          <div
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/40"
          >
            <div className="min-w-0">
              <span className="font-medium text-sm text-foreground">{p.full_name}</span>
              <span className="ml-2 text-xs font-mono text-muted-foreground">{p.partner_code}</span>
              <p className="text-xs text-muted-foreground">
                {p.mobile} · joined {format(new Date(p.joined_at), "dd MMM yyyy")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => review(p, "active")} disabled={busyId === p.id}>
                {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => review(p, "rejected")} disabled={busyId === p.id}>
                <X className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default PendingPartnerAlerts;
