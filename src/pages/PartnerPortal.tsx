import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PartnerJobCard, { type PartnerJob } from "@/components/PartnerJobCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, FileText, Loader2, Upload, Truck, RefreshCw, LogOut, UserRound, ShieldCheck, Package, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DOC_TYPES, VEHICLE_TYPES, getPhotoUrl, statusVariant } from "@/lib/partners";
import type { Tables } from "@/integrations/supabase/types";
import type { Session } from "@supabase/supabase-js";
import { useHandoverUpdates } from "@/hooks/useHandoverUpdates";

type Partner = Tables<"delivery_partners">;
type Doc = Tables<"partner_documents">;
type Job = PartnerJob;

const emptyForm = { full_name: "", mobile: "", email: "", address: "", vehicle_type: "bike", vehicle_number: "" };
const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
const isSupportedPhoto = (file: File) =>
  ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= MAX_PROFILE_PHOTO_SIZE;
const photoExtension = (file: File) => {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
};

const PartnerPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState("driving_licence");
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionRetry, setSessionRetry] = useState(0);
  useHandoverUpdates(() => { if (userId) void load(userId).catch(() => setLoadError("Could not refresh jobs. Please try again.")); });

  const refresh = async () => {
    if (!userId || refreshing) return;
    setRefreshing(true);
    try { await load(userId); } finally { setRefreshing(false); }
  };

  const load = async (uid: string, isCurrent = () => true) => {
    const { data, error } = await supabase.from("delivery_partners").select("*").eq("user_id", uid).maybeSingle();
    if (error) throw error;
    if (!isCurrent()) return;
    setPartner(data);
    if (data) {
      setForm({
        full_name: data.full_name, mobile: data.mobile, email: data.email ?? "", address: data.address ?? "",
        vehicle_type: data.vehicle_type, vehicle_number: data.vehicle_number,
      });
      const photo = await getPhotoUrl(data.photo_path);
      if (!isCurrent()) return;
      setPhotoUrl(photo);
      const [{ data: d, error: docError }, { data: j, error: jobError }, { data: contacts }] = await Promise.all([
        supabase.from("partner_documents").select("*").eq("partner_id", data.id).order("created_at"),
        supabase.from("bookings").select("id, tracking_id, pickup_location, delivery_location, pickup_date, pickup_time, drop_off_date, delivery_time, status, number_of_bags, amount")
          .eq("assigned_partner_id", data.id).order("pickup_date", { ascending: false }),
        supabase.rpc("get_partner_job_customers"),
      ]);
      if (docError) throw docError;
      if (jobError) throw jobError;
      if (!isCurrent()) return;
      setDocs(d ?? []);
      const contactMap = new Map((contacts ?? []).map((c) => [c.booking_id, c]));
      setJobs((j ?? []).map((job) => ({
        ...job,
        customer_name: contactMap.get(job.id)?.full_name ?? null,
        customer_phone: contactMap.get(job.id)?.phone ?? null,
      })));
    }
  };

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let currentUser: string | null | undefined;
    let deferred: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const fail = () => {
      if (disposed) return;
      generation += 1;
      currentUser = undefined;
      clearTimeout(timeout);
      setLoadError("Could not open your partner dashboard. Check your connection and try again.");
      setLoading(false);
    };
    const startTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(fail, 20000);
    };
    const applySession = async (session: Session | null) => {
      if (disposed || currentUser === (session?.user.id ?? null)) return;
      currentUser = session?.user.id ?? null;
      const request = ++generation;
      const isCurrent = () => !disposed && generation === request;
      setLoadError(null);
      setLoading(true);
      startTimeout();
      setUserId(session?.user.id ?? null);
      setPartner(null);
      setDocs([]);
      setJobs([]);
      setPhotoUrl(null);
      try {
        if (session?.user) {
          setForm({ ...emptyForm, email: session.user.email ?? "", full_name: session.user.user_metadata?.full_name ?? "" });
          await load(session.user.id, isCurrent);
        }
      } catch {
        if (isCurrent()) fail();
      } finally {
        if (isCurrent()) {
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    };
    const checkSession = async () => {
      const request = generation;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (disposed || request !== generation) return;
        if (error) throw error;
        await applySession(session);
      } catch {
        if (!disposed && request === generation) fail();
      }
    };

    // Defer database requests until the auth callback releases the session lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(deferred);
      deferred = setTimeout(() => { void applySession(session); }, 0);
    });
    const resume = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    setLoading(true);
    setLoadError(null);
    startTimeout();
    void checkSession();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearTimeout(deferred);
      clearTimeout(timeout);
      subscription.unsubscribe();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [sessionRetry]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const preview = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photoFile]);

  const validate = () => {
    if (!form.full_name.trim()) return "Please enter your full name";
    if (!/^[0-9+\-\s()]{10,20}$/.test(form.mobile.trim())) return "Please enter a valid mobile number";
    if (form.vehicle_number.trim().length < 3) return "Please enter your vehicle registration number";
    return null;
  };

  const payload = () => ({
    full_name: form.full_name.trim(),
    mobile: form.mobile.trim(),
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    vehicle_type: form.vehicle_type,
    vehicle_number: form.vehicle_number.trim().toUpperCase(),
  });

  const save = async () => {
    const err = validate();
    if (err) return toast({ title: err, variant: "destructive" });
    if (!userId) return;
    setSaving(true);
    let error: string | null = null;
    let newPartnerId: string | null = null;
    if (partner) {
      const res = await supabase.from("delivery_partners").update(payload()).eq("id", partner.id);
      error = res.error ? res.error.message : null;
    } else {
      const res = await supabase
        .from("delivery_partners")
        .insert({ ...payload(), user_id: userId, partner_code: "" })
        .select("id")
        .single();
      error = res.error ? res.error.message : null;
      newPartnerId = res.data?.id ?? null;
    }

    // Registration uploads happen now that the partner row exists.
    if (!error && newPartnerId) {
      if (photoFile) {
        const path = `${userId}/avatar-${Date.now()}.${photoExtension(photoFile)}`;
        const { error: uploadError } = await supabase.storage.from("partner-photos").upload(path, photoFile);
        if (uploadError) {
          toast({ title: "Photo upload failed", description: uploadError.message, variant: "destructive" });
        } else {
          const { error: profileError } = await supabase.from("delivery_partners").update({ photo_path: path }).eq("id", newPartnerId);
          if (profileError) {
            await supabase.storage.from("partner-photos").remove([path]);
            toast({ title: "Photo could not be saved", description: profileError.message, variant: "destructive" });
          }
        }
      }
      if (aadhaarFile) {
        const path = `${userId}/aadhaar-${Date.now()}.${aadhaarFile.name.split(".").pop()}`;
        const up = await supabase.storage.from("partner-documents").upload(path, aadhaarFile);
        if (up.error) toast({ title: "Aadhaar upload failed", description: up.error.message, variant: "destructive" });
        else {
          const ins = await supabase.from("partner_documents").insert({ partner_id: newPartnerId, user_id: userId, doc_type: "aadhaar", file_path: path });
          if (ins.error) toast({ title: "Aadhaar upload failed", description: ins.error.message, variant: "destructive" });
        }
      }
    }
    setPhotoFile(null);
    setAadhaarFile(null);
    setSaving(false);
    if (error) return toast({ title: "Could not save", description: error, variant: "destructive" });
    toast({ title: partner ? "Profile updated" : "Registration submitted", description: partner ? undefined : "Our team will review and activate your account." });
    load(userId);
  };

  const setAvailability = async (v: string) => {
    if (!partner) return;
    const { error } = await supabase.from("delivery_partners").update({ availability_status: v }).eq("id", partner.id);
    if (!error) setPartner({ ...partner, availability_status: v });
    else toast({ title: "Could not change availability", description: error.message, variant: "destructive" });
  };

  const uploadPhoto = async (file: File) => {
    if (!partner || !userId) return;
    if (!isSupportedPhoto(file)) {
      toast({ title: "Choose a JPG, PNG, or WebP photo", variant: "destructive" });
      return;
    }
    setPhotoUploading(true);
    const path = `${userId}/avatar-${Date.now()}.${photoExtension(file)}`;
    const { error: uploadError } = await supabase.storage.from("partner-photos").upload(path, file);
    if (uploadError) {
      setPhotoUploading(false);
      toast({ title: "Photo upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }
    const { error: profileError } = await supabase.from("delivery_partners").update({ photo_path: path }).eq("id", partner.id);
    if (profileError) {
      await supabase.storage.from("partner-photos").remove([path]);
      setPhotoUploading(false);
      toast({ title: "Photo could not be saved", description: profileError.message, variant: "destructive" });
      return;
    }
    if (partner.photo_path) await supabase.storage.from("partner-photos").remove([partner.photo_path]);
    setPartner({ ...partner, photo_path: path });
    setPhotoUrl(await getPhotoUrl(path));
    setPhotoUploading(false);
    toast({ title: "Profile photo updated" });
  };

  const uploadDoc = async (file: File) => {
    if (!partner || !userId) return;
    setUploading(true);
    const path = `${userId}/${docType}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("partner-documents").upload(path, file);
    if (!error) {
      const { error: e2 } = await supabase.from("partner_documents").insert({ partner_id: partner.id, user_id: userId, doc_type: docType, file_path: path });
      if (e2) toast({ title: "Upload failed", description: e2.message, variant: "destructive" });
      else toast({ title: "Document uploaded" });
    } else toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    setUploading(false);
    load(userId);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (loadError) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p role="alert" className="text-foreground">{loadError}</p>
      <Button onClick={() => setSessionRetry((value) => value + 1)}>Try again</Button>
      <Button variant="outline" onClick={() => navigate("/partner/login")}>Back to partner login</Button>
    </div>;
  }

  const formFields = (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Full name *</Label><Input value={form.full_name} maxLength={100} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Mobile number *</Label><Input type="tel" value={form.mobile} maxLength={20} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
        <div className="space-y-2"><Label>Email (optional)</Label><Input type="email" value={form.email} maxLength={255} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Vehicle type *</Label>
          <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{VEHICLE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Vehicle registration number *</Label><Input value={form.vehicle_number} maxLength={20} placeholder="e.g. UP32 AB 1234" onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>Address (private — never shown to customers)</Label><Textarea rows={2} maxLength={500} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      {!partner && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Profile photo</Label>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 shrink-0">
                {photoPreviewUrl && <AvatarImage src={photoPreviewUrl} alt="Selected profile photo" />}
                <AvatarFallback><Camera className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <label className="flex min-w-0 flex-1 items-center gap-2 border border-input rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                <Upload className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{photoFile ? photoFile.name : "Choose a photo (up to 5 MB)"}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (isSupportedPhoto(f)) setPhotoFile(f); else toast({ title: "Choose a JPG, PNG, or WebP photo up to 5 MB", variant: "destructive" }); e.target.value = ""; } }} />
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Aadhaar (for verification)</Label>
            <label className="flex items-center gap-2 border border-input rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
              <Upload className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{aadhaarFile ? aadhaarFile.name : "Choose image or PDF"}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAadhaarFile(f); e.target.value = ""; } }} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Optional — you can also add these later from your partner dashboard. Documents stay private; only you and Luggo admins can see them.
          </p>
        </div>
      )}
      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{partner ? "Save changes" : "Register as partner"}
      </Button>
    </div>
  );

  const today = format(new Date(), "yyyy-MM-dd");
  const currentJobs = jobs.filter((j) => !["completed", "delivered", "cancelled"].includes(j.status));
  const completedJobs = jobs.filter((j) => ["completed", "delivered"].includes(j.status));

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-admin text-admin-foreground px-4 sm:px-6 py-4 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 text-sm font-extrabold"><span className="rounded-lg bg-accent p-2 text-accent-foreground"><Truck className="h-4 w-4" /></span>LUGGO <span className="text-accent">AGENT</span></a>
          {userId && <div className="flex gap-1">
            <Button variant="ghost" size="icon" title="My profile" aria-label="My profile" className="h-8 w-8 text-admin-muted hover:bg-admin-soft" onClick={() => setShowProfile(!showProfile)}><UserRound /></Button>
            <Button variant="ghost" size="icon" title="Refresh jobs" aria-label="Refresh jobs" disabled={refreshing} className="h-8 w-8 text-admin-muted hover:bg-admin-soft" onClick={refresh}><RefreshCw className={refreshing ? "animate-spin" : ""} /></Button>
            <Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" className="h-8 w-8 text-accent hover:bg-admin-soft" onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) return toast({ title: "Could not sign out", variant: "destructive" }); setUserId(null); setPartner(null); navigate("/partner/login"); }}><LogOut /></Button>
          </div>}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {partner && <Avatar className="h-10 w-10"><AvatarImage src={photoUrl ?? undefined} alt={partner.full_name} /><AvatarFallback className="bg-admin-soft text-admin-foreground">{partner.full_name.charAt(0)}</AvatarFallback></Avatar>}
            <div><h1 className="flex items-center gap-2 text-lg font-bold">{partner ? `Welcome, ${partner.full_name.split(" ")[0]}` : "Delivery Partner"}{partner?.verification_status === "verified" && <ShieldCheck className="h-4 w-4 text-success" />}</h1><p className="mt-1 font-mono text-[11px] font-semibold text-accent">{partner ? `Partner ID: ${partner.partner_code}` : "Luggo partner portal"}</p></div>
          </div>
          {partner && <Select value={partner.availability_status} onValueChange={setAvailability} disabled={partner.account_status !== "active"}><SelectTrigger aria-label="Availability" className="h-8 w-32 rounded-full border-success/25 bg-success/10 text-success text-xs capitalize"><span className="h-2 w-2 rounded-full bg-success shrink-0" /><SelectValue /></SelectTrigger><SelectContent>{["available", "busy", "offline"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>}
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 space-y-5 ${!partner || showProfile ? "max-w-2xl" : "max-w-md"}`}>

        {!userId ? (
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-muted-foreground">Sign in to register as a Luggo delivery partner or view your partner profile.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate("/partner/login")}>Sign in</Button>
                <Button variant="outline" onClick={() => navigate("/partner/login?mode=signup")}>Create account</Button>
              </div>
            </CardContent>
          </Card>
        ) : !partner ? (
          <Card>
            <CardHeader>
              <CardTitle>Become a Luggo partner</CardTitle>
              <CardDescription>Fill in your details. After review, our team will activate your account.</CardDescription>
            </CardHeader>
            <CardContent>{formFields}</CardContent>
          </Card>
        ) : (
          <>
            {partner.account_status !== "active" && <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-foreground"><p className="font-semibold capitalize">Account {partner.account_status}</p><p className="mt-1 text-xs text-muted-foreground">{partner.account_status === "pending" ? "Your registration is awaiting review." : "Contact Luggo to check your account status."}</p></div>}
            <div className="grid grid-cols-2 gap-3">
              {[["Today's pickups", jobs.filter((j) => j.pickup_date === today && j.status !== "cancelled").length], ["Today's deliveries", jobs.filter((j) => j.drop_off_date === today && j.status !== "cancelled").length]].map(([label, value], index) => <div key={label} className="rounded-lg bg-card px-4 py-4 text-center shadow-md"><p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-extrabold ${index === 0 ? "text-accent" : "text-foreground"}`}>{value}</p></div>)}
            </div>
            <section aria-label="Assigned jobs" className="space-y-4">
              {currentJobs.length ? currentJobs.map((job) => <PartnerJobCard key={job.id} job={job} />) : <div className="rounded-lg border border-border bg-card px-6 py-10 text-center shadow-sm"><Package className="mx-auto h-9 w-9 text-accent" /><h2 className="mt-3 font-bold">No active jobs</h2><p className="mt-2 text-sm text-muted-foreground">Your assigned pickups and deliveries will appear here.</p></div>}
            </section>
            <section aria-label="Completed jobs" className="rounded-lg bg-card p-5 shadow-md">
              <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">Completed Jobs</h2><span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">{completedJobs.length} Jobs</span></div>
              {completedJobs.length ? <ul className="mt-4 divide-y divide-border">{completedJobs.map((j) => <li key={j.id} className="flex items-start gap-2 py-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-success shrink-0" /><div className="min-w-0"><p className="text-xs font-semibold break-all">{j.tracking_id ?? "Booking"}</p><p className="mt-1 text-xs text-muted-foreground">{j.number_of_bags} bag(s) · {j.drop_off_date}</p></div></li>)}</ul> : <p className="py-8 text-center text-xs text-muted-foreground">No completed jobs yet.</p>}
            </section>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowProfile(!showProfile)} aria-expanded={showProfile}><UserRound />{showProfile ? "Hide profile & documents" : "My profile & documents"}</Button>
            {showProfile && <>
            <Card>
              <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-24 w-24">
                    {photoUrl && <AvatarImage src={photoUrl} alt={`${partner.full_name} profile photo`} />}
                    <AvatarFallback className="text-2xl">{partner.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <Button variant="outline" size="sm" asChild disabled={photoUploading}>
                    <label className="cursor-pointer">
                      {photoUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                      {photoUploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={photoUploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); e.target.value = ""; }} />
                    </label>
                  </Button>
                </div>
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <p className="text-sm text-muted-foreground">Partner ID</p>
                  <p className="text-2xl font-mono font-bold text-foreground">{partner.partner_code}</p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <Badge variant={statusVariant(partner.account_status)} className="capitalize">Account: {partner.account_status}</Badge>
                    <Badge variant={statusVariant(partner.verification_status)} className="capitalize">Verification: {partner.verification_status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Joined {format(new Date(partner.joined_at), "dd MMM yyyy")}</p>
                </div>
                <div className="space-y-2 w-full sm:w-40">
                  <Label>Availability</Label>
                  <Select value={partner.availability_status} onValueChange={setAvailability} disabled={partner.account_status !== "active"}>
                    <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["available", "busy", "offline"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {partner.account_status !== "active" && <p className="text-xs text-muted-foreground">Available once your account is active.</p>}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              {[["Pickups", partner.total_pickups], ["Deliveries", partner.total_deliveries], ["Completed", partner.completed_jobs]].map(([l, v]) => (
                <Card key={l as string}><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{v}</p><p className="text-sm text-muted-foreground">{l}</p></CardContent></Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle>My details</CardTitle></CardHeader>
              <CardContent>{formFields}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification documents</CardTitle>
                <CardDescription>Private — only you and Luggo admins can see these.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button asChild variant="outline" disabled={uploading}>
                    <label className="cursor-pointer">
                      {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}Upload file
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])} />
                    </label>
                  </Button>
                </div>
                {docs.length > 0 && (
                  <ul className="space-y-2 text-sm">
                    {docs.map((d) => (
                      <li key={d.id} className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />{DOC_TYPES.find((t) => t.value === d.doc_type)?.label}</span>
                        <Badge variant={statusVariant(d.review_status)} className="capitalize">{d.review_status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            </>}
          </>
        )}
      </main>
    </div>
  );
};

export default PartnerPortal;
