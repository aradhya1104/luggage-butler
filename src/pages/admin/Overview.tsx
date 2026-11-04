import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ClipboardList, Loader2, Package, Truck, Wallet, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAdminAuth } from "@/components/admin/AdminLayout";
import PendingPartnerAlerts from "@/components/PendingPartnerAlerts";
import {
  AdminPageHeader,
  StatusPill,
  formatInr,
  shortBookingCode,
  useAdminBookings,
} from "./shared";

interface AdminRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  status: string;
  requested_at: string;
}

const KpiCard = ({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tint: string;
}) => (
  <Card className="rounded-2xl shadow-md">
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none truncate">{value}</p>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mt-1.5">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const Overview = () => {
  const { isSuperAdmin } = useAdminAuth();
  const { toast } = useToast();
  const { bookings, loading } = useAdminBookings();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from("admin_requests")
      .select("*")
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    setRequests(data ?? []);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) loadRequests();
  }, [isSuperAdmin, loadRequests]);

  const reviewRequest = async (request: AdminRequest, approve: boolean) => {
    setBusyRequestId(request.id);
    if (approve) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: request.user_id, role: "admin" });
      if (roleError) {
        toast({ title: "Error", description: "Failed to approve admin request", variant: "destructive" });
        setBusyRequestId(null);
        return;
      }
    }
    const { error } = await supabase
      .from("admin_requests")
      .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", request.id);
    setBusyRequestId(null);
    if (error) {
      toast({ title: "Error", description: "Failed to update request status", variant: "destructive" });
      return;
    }
    toast({
      title: approve ? "Approved" : "Rejected",
      description: `${request.email} ${approve ? "is now an admin" : "was rejected"}`,
    });
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
  };

  const active = bookings.filter((b) => ["paid", "in_storage", "in_transit"].includes(b.status)).length;
  const inStorage = bookings.filter((b) => b.status === "in_storage").length;
  const revenue = bookings.filter((b) => b.status !== "pending").reduce((sum, b) => sum + b.amount, 0);
  const recent = bookings.slice(0, 8);

  return (
    <div>
      <AdminPageHeader eyebrow="Operations Control" title="Overview">
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="hidden" aria-hidden />
      </AdminPageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={ClipboardList} label="Total bookings" value={loading ? "…" : String(bookings.length)} tint="bg-primary/10 text-primary" />
        <KpiCard icon={Truck} label="Active jobs" value={loading ? "…" : String(active)} tint="bg-accent/10 text-accent" />
        <KpiCard icon={Package} label="In storage" value={loading ? "…" : String(inStorage)} tint="bg-warning/10 text-warning" />
        <KpiCard icon={Wallet} label="Revenue" value={loading ? "…" : formatInr(revenue)} tint="bg-success/10 text-success" />
      </div>

      <div className="space-y-6 mb-8">
        <PendingPartnerAlerts />
        {isSuperAdmin && requests.length > 0 && (
          <Card className="border-accent/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="w-2 h-2 rounded-full bg-accent" />
                Admin access requests ({requests.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                People asking for admin access to this dashboard.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/40"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-sm text-foreground">{r.full_name || r.email}</span>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.email} · requested {format(new Date(r.requested_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => reviewRequest(r, true)} disabled={busyRequestId === r.id}>
                      {busyRequestId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => reviewRequest(r, false)} disabled={busyRequestId === r.id}>
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-accent" />
            Recent bookings
          </CardTitle>
          <Link to="/admin/dashboard/bookings" className="text-sm font-semibold text-accent hover:underline">
            View all bookings →
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading bookings…</p>
          ) : recent.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((b) => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3">
                  <div className="w-40 shrink-0">
                    <span className="font-mono text-sm font-semibold">{shortBookingCode(b)}</span>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.customer_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {b.pickup_location} → {b.delivery_location || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold">{formatInr(b.amount)}</span>
                    <StatusPill status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Overview;
