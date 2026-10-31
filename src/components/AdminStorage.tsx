import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Row {
  id: string;
  tracking_id: string | null;
  pickup_location: string;
  pickup_date: string;
  pickup_time: string | null;
  drop_off_date: string;
  delivery_time: string | null;
  number_of_bags: number;
  status: string;
  customer_name?: string | null;
}

// Luggage currently in Luggo's custody: paid bookings awaiting pickup plus bags held in the warehouse.
const STORAGE_STATUSES = ["paid", "in_storage"];

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    paid: { label: "Paid", className: "bg-blue-500 text-white" },
    in_storage: { label: "In Storage", className: "bg-amber-500 text-white" },
  };
  const s = map[status];
  return s ? <Badge className={s.className}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
};

const AdminStorage = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: bookingsData, error } = await supabase
      .from("bookings")
      .select("id, tracking_id, pickup_location, pickup_date, pickup_time, drop_off_date, delivery_time, number_of_bags, status, user_id")
      .in("status", STORAGE_STATUSES)
      .order("pickup_date", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load storage inventory", variant: "destructive" });
      setLoading(false);
      return;
    }

    const userIds = [...new Set(bookingsData?.map((b) => b.user_id) || [])];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    const profilesMap = new Map(profilesData?.map((p) => [p.user_id, p.full_name]) || []);

    setRows(
      bookingsData?.map((b) => ({ ...b, customer_name: profilesMap.get(b.user_id) || null })) || []
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = rows.filter(
    (r) =>
      !q ||
      (r.tracking_id || "").toLowerCase().includes(q) ||
      (r.customer_name || "").toLowerCase().includes(q)
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Active Storage Inventory ({filtered.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Luggage in Luggo's custody — paid bookings awaiting pickup, plus bags held in the warehouse.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder="Search by tracking ID or customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading inventory…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No luggage currently held in the storage warehouse.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Bags</TableHead>
                <TableHead>Intake (pickup)</TableHead>
                <TableHead>Expected delivery</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.tracking_id || "—"}</TableCell>
                  <TableCell className="text-sm">{r.customer_name || "—"}</TableCell>
                  <TableCell className="font-medium">{r.number_of_bags} bag(s)</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(r.pickup_date), "dd MMM yyyy")}
                    {r.pickup_time ? ` · ${r.pickup_time}` : ""}
                    <div className="text-xs text-muted-foreground max-w-[200px] truncate">{r.pickup_location}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(r.drop_off_date), "dd MMM yyyy")}
                    {r.delivery_time ? ` · ${r.delivery_time}` : ""}
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminStorage;
