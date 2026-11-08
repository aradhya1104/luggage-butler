import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHandoverUpdates } from "@/hooks/useHandoverUpdates";

type Stage = "pickup" | "delivery";
type Handover = { code: string | null; expires_at: string; locked_until: string | null; verified_at: string | null };
type Handovers = { pickup?: Handover; delivery?: Handover; status?: string };
const timestamp = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " IST";

export default function BookingHandover({ bookingId, role }: { bookingId: string; role: "customer" | "partner" | "admin" }) {
  const [data, setData] = useState<Handovers>({});
  const [codes, setCodes] = useState({ pickup: "", delivery: "" });
  const [busy, setBusy] = useState<Stage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [audit, setAudit] = useState<{ id: string; stage: string; event: string; created_at: string }[]>([]);
  const [now, setNow] = useState(Date.now());
  const load = async () => {
    const { data: result, error: failure } = await supabase.rpc("get_booking_handovers", { p_booking_id: bookingId });
    if (failure) setError(failure.message);
    else setData(result as Handovers);
    if (role === "admin") {
      const { data: events } = await supabase.from("handover_audit").select("id, stage, event, created_at").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(50);
      setAudit(events ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [bookingId, role]);
  useHandoverUpdates(() => { void load(); }, bookingId);
  const act = async (stage: Stage, action: "generate" | "verify") => {
    setBusy(stage); setError(""); setMessage("");
    try {
      const { data: result, error: failure } = await supabase.rpc("booking_handover_action", { p_booking_id: bookingId, p_stage: stage, p_action: action, p_code: action === "verify" ? codes[stage] : null });
      const response = result as { ok?: boolean; error?: string } | null;
      if (failure || !response?.ok) setError(failure?.message ?? response?.error ?? "Could not verify handover");
      else { setCodes({ pickup: "", delivery: "" }); setMessage(action === "verify" ? `${stage === "pickup" ? "Pickup" : "Delivery"} verified successfully` : "Arrival confirmed. OTP generated."); }
      await load();
    } catch { setError("Connection interrupted. Please try again."); }
    finally { setBusy(null); }
  };
  const closed = ["pending", "cancelled", "delivered", "completed"].includes(data.status ?? "pending");
  return (
    <section aria-label="Handover verification" className="mt-4 border-t border-border pt-4 space-y-4">
      <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-accent" />Handover verification</h3><Button variant="ghost" size="icon" aria-label="Refresh handover" title="Refresh handover" onClick={() => { setError(""); void load(); }}><RefreshCw className="h-4 w-4" /></Button></div>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (["pickup", "delivery"] as Stage[]).map(stage => {
        const record = data[stage];
        const verified = record?.verified_at;
        const expired = record ? new Date(record.expires_at).getTime() <= now : false;
        const locked = record?.locked_until ? new Date(record.locked_until).getTime() > now : false;
        const display = role === "admin" || (role === "partner" && stage === "pickup") || (role === "customer" && stage === "delivery");
        const canVerify = (role === "customer" && stage === "pickup") || (role === "partner" && stage === "delivery");
        const title = stage === "pickup" ? "Pickup OTP" : "Delivery OTP";
        return <div key={stage} className="space-y-2">
          <div className="flex flex-wrap justify-between gap-1 text-xs"><h4 className="font-semibold">{title}</h4><span className={verified ? "text-success" : "text-muted-foreground"}>{verified ? "Verified" : "Not verified"}</span></div>
          {verified ? <p className="text-xs text-success">Verified {timestamp(verified)}</p> : <>
            {display && record?.code && !expired && <><p className="font-mono text-2xl font-bold text-accent" aria-label={`${title} code`}>{record.code}</p><p className="text-xs text-muted-foreground">{role === "partner" ? "Share with the customer." : role === "customer" ? "Share only with your assigned delivery partner." : "Active code"} Expires {timestamp(record.expires_at)}.</p></>}
            {(!record || expired) && <p className="text-xs text-muted-foreground">{expired ? "OTP expired. A new code is required." : stage === "delivery" && !data.pickup?.verified_at ? "Awaiting pickup verification." : "Awaiting partner arrival."}</p>}
            {locked && <p className="text-xs text-destructive">Locked until {timestamp(record?.locked_until ?? "")}.</p>}
            {role === "partner" && !closed && (stage === "pickup" || !!data.pickup?.verified_at) && (!record || expired) && <Button size="sm" variant="outline" className="w-full" disabled={!!busy || locked} onClick={() => void act(stage, "generate")}>{busy === stage && <Loader2 className="h-4 w-4 animate-spin" />}Arrived at {stage} · Generate OTP</Button>}
            {canVerify && !closed && <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); void act(stage, "verify"); }}><Input aria-label={`Enter ${title}`} placeholder="6-digit OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codes[stage]} onChange={e => setCodes(prev => ({ ...prev, [stage]: e.target.value.replace(/\D/g, "") }))} disabled={!record || expired || locked || !!busy} className="min-w-0 sm:flex-1 font-mono" /><Button type="submit" size="sm" disabled={codes[stage].length !== 6 || !record || expired || locked || !!busy}>{busy === stage && <Loader2 className="h-4 w-4 animate-spin" />}Verify {stage === "pickup" ? "Pickup" : "Delivery"} OTP</Button></form>}
          </>}
        </div>;
      })}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {message && <p role="status" className="text-xs text-success">{message}</p>}
      {role === "admin" && audit.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold">Handover audit history</summary><ul className="mt-2 space-y-2">{audit.map(event => <li key={event.id} className="text-xs text-muted-foreground capitalize">{event.stage} · {event.event.replace(/_/g, " ")} · {timestamp(event.created_at)}</li>)}</ul></details>}
    </section>
  );
}