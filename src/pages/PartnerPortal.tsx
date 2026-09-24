import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, FileText, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DOC_TYPES, VEHICLE_TYPES, getPhotoUrl, statusVariant } from "@/lib/partners";
import type { Tables } from "@/integrations/supabase/types";

type Partner = Tables<"delivery_partners">;
type Doc = Tables<"partner_documents">;
type Job = Pick<Tables<"bookings">, "id" | "tracking_id" | "pickup_location" | "delivery_location" | "pickup_date" | "pickup_time" | "status" | "number_of_bags">;

const emptyForm = { full_name: "", mobile: "", email: "", address: "", vehicle_type: "bike", vehicle_number: "" };

const PartnerPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docType, setDocType] = useState("driving_licence");
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);

  const load = async (uid: string) => {
    const { data } = await supabase.from("delivery_partners").select("*").eq("user_id", uid).maybeSingle();
    setPartner(data);
    if (data) {
      setForm({
        full_name: data.full_name, mobile: data.mobile, email: data.email ?? "", address: data.address ?? "",
        vehicle_type: data.vehicle_type, vehicle_number: data.vehicle_number,
      });
      setPhotoUrl(await getPhotoUrl(data.photo_path));
      const [{ data: d }, { data: j }] = await Promise.all([
        supabase.from("partner_documents").select("*").eq("partner_id", data.id).order("created_at"),
        supabase.from("bookings").select("id, tracking_id, pickup_location, delivery_location, pickup_date, pickup_time, status, number_of_bags")
          .eq("assigned_partner_id", data.id).order("pickup_date", { ascending: false }),
      ]);
      setDocs(d ?? []);
      setJobs(j ?? []);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setForm((f) => ({ ...f, email: session.user.email ?? "", full_name: session.user.user_metadata?.full_name ?? "" }));
        await load(session.user.id);
      }
      setLoading(false);
    });
  }, []);

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
    const { error } = partner
      ? await supabase.from("delivery_partners").update(payload()).eq("id", partner.id)
      : await supabase.from("delivery_partners").insert({ ...payload(), user_id: userId, partner_code: "" });
    setSaving(false);
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    toast({ title: partner ? "Profile updated" : "Registration submitted", description: partner ? undefined : "Our team will review and activate your account." });
    load(userId);
  };

  const setAvailability = async (v: string) => {
    if (!partner) return;
    const { error } = await supabase.from("delivery_partners").update({ availability_status: v }).eq("id", partner.id);
    if (!error) setPartner({ ...partner, availability_status: v });
  };

  const uploadPhoto = async (file: File) => {
    if (!partner || !userId) return;
    if (!file.type.startsWith("image/")) return toast({ title: "Please choose an image", variant: "destructive" });
    const path = `${userId}/avatar-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("partner-photos").upload(path, file, { upsert: true });
    if (error) return toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    await supabase.from("delivery_partners").update({ photo_path: path }).eq("id", partner.id);
    if (partner.photo_path) supabase.storage.from("partner-photos").remove([partner.photo_path]);
    setPartner({ ...partner, photo_path: path });
    setPhotoUrl(await getPhotoUrl(path));
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
      <Button className="w-full" onClick={save} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{partner ? "Save changes" : "Register as partner"}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Delivery Partner</h1>

        {!userId ? (
          <Card>
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-muted-foreground">Sign in to register as a Luggo delivery partner or view your partner profile.</p>
              <Button onClick={() => navigate("/auth")}>Sign in</Button>
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
            <Card>
              <CardContent className="p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <label className="relative cursor-pointer group">
                  <Avatar className="h-24 w-24">
                    {photoUrl && <AvatarImage src={photoUrl} />}
                    <AvatarFallback className="text-2xl">{partner.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 text-primary-foreground"><Camera className="h-4 w-4" /></span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
                </label>
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
              <CardHeader><CardTitle>Assigned jobs</CardTitle></CardHeader>
              <CardContent>
                {jobs.length === 0 ? <p className="text-muted-foreground text-sm">No jobs assigned yet.</p> : (
                  <ul className="divide-y divide-border">
                    {jobs.map((j) => (
                      <li key={j.id} className="py-3 text-sm flex justify-between gap-3">
                        <div>
                          <p className="font-mono text-muted-foreground">{j.tracking_id}</p>
                          <p className="text-foreground">{j.pickup_location}</p>
                          {j.delivery_location && <p className="text-muted-foreground">→ {j.delivery_location}</p>}
                          <p className="text-muted-foreground">{j.pickup_date}{j.pickup_time ? ` · ${j.pickup_time}` : ""} · {j.number_of_bags} bag(s)</p>
                        </div>
                        <Badge variant="outline" className="h-fit capitalize">{j.status.replace("_", " ")}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

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
          </>
        )}
      </div>
    </div>
  );
};

export default PartnerPortal;
