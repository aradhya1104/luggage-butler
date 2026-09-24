import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, FileText, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DOC_TYPES, getPhotoUrl, statusVariant, vehicleLabel } from "@/lib/partners";
import type { Tables } from "@/integrations/supabase/types";

type Partner = Tables<"delivery_partners">;
type Doc = Tables<"partner_documents">;

const AdminPartners = () => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, Doc[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("delivery_partners").select("*").order("joined_at", { ascending: false });
    const list = data ?? [];
    setPartners(list);
    const urls: Record<string, string> = {};
    await Promise.all(list.map(async (p) => {
      const u = await getPhotoUrl(p.photo_path);
      if (u) urls[p.id] = u;
    }));
    setPhotos(urls);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<Partner>) => {
    const { error } = await supabase.from("delivery_partners").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    toast({ title: "Partner updated" });
  };

  const toggle = async (id: string) => {
    if (expanded === id) return setExpanded(null);
    setExpanded(id);
    const { data } = await supabase.from("partner_documents").select("*").eq("partner_id", id).order("created_at");
    setDocs((d) => ({ ...d, [id]: data ?? [] }));
  };

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("partner-documents").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  const reviewDoc = async (partnerId: string, docId: string, review_status: string) => {
    const { error } = await supabase.from("partner_documents").update({ review_status }).eq("id", docId);
    if (!error) setDocs((d) => ({ ...d, [partnerId]: d[partnerId].map((x) => (x.id === docId ? { ...x, review_status } : x)) }));
  };

  const StatusSelect = ({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[120px] h-8 capitalize"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Delivery Partners ({partners.length})</CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {partners.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No partners have registered yet. Partners sign up at /partner.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Jobs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p) => (
                <Fragment key={p.id}>
                  <TableRow>
                    <TableCell className="cursor-pointer" onClick={() => toggle(p.id)}>
                      {expanded === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <Avatar className="h-8 w-8">
                          {photos[p.id] && <AvatarImage src={photos[p.id]} />}
                          <AvatarFallback>{p.full_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{p.full_name}</div>
                          <div className="text-xs font-mono text-muted-foreground">{p.partner_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.mobile}</TableCell>
                    <TableCell className="text-sm">{vehicleLabel(p.vehicle_type)}<div className="text-xs text-muted-foreground">{p.vehicle_number}</div></TableCell>
                    <TableCell><StatusSelect value={p.verification_status} options={["pending", "verified", "rejected"]} onChange={(v) => update(p.id, { verification_status: v })} /></TableCell>
                    <TableCell><StatusSelect value={p.account_status} options={["pending", "active", "suspended", "inactive"]} onChange={(v) => update(p.id, { account_status: v })} /></TableCell>
                    <TableCell><Badge variant={statusVariant(p.availability_status)} className="capitalize">{p.availability_status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {p.total_pickups} pickups<br />{p.total_deliveries} deliveries<br />{p.completed_jobs} completed
                    </TableCell>
                  </TableRow>
                  {expanded === p.id && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={8} className="p-5">
                        <div className="grid md:grid-cols-2 gap-6 text-sm">
                          <div className="space-y-1">
                            <div><span className="font-medium">Email:</span> {p.email || "—"}</div>
                            <div><span className="font-medium">Address:</span> {p.address || "—"}</div>
                            <div><span className="font-medium">Joined:</span> {format(new Date(p.joined_at), "dd MMM yyyy")}</div>
                          </div>
                          <div>
                            <div className="font-medium mb-2">Verification documents</div>
                            {(docs[p.id] ?? []).length === 0 ? (
                              <p className="text-muted-foreground">No documents uploaded.</p>
                            ) : (
                              <ul className="space-y-2">
                                {docs[p.id].map((d) => (
                                  <li key={d.id} className="flex items-center gap-2 flex-wrap">
                                    <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => openDoc(d.file_path)}>
                                      <FileText className="w-4 h-4 mr-1" />
                                      {DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type}
                                    </Button>
                                    <StatusSelect value={d.review_status} options={["pending", "approved", "rejected"]} onChange={(v) => reviewDoc(p.id, d.id, v)} />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPartners;
