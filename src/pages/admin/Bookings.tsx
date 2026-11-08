import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calendar,
  FileSpreadsheet,
  Hash,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Send,
  User as UserIcon,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import DispatchPartnerModal from "@/components/DispatchPartnerModal";
import BookingHandover from "@/components/BookingHandover";
import {
  AdminPageHeader,
  STATUS_ORDER,
  StatusPill,
  formatInr,
  shortBookingCode,
  statusMeta,
  useAdminBookings,
  type AdminBooking,
} from "./shared";

const STATUS_OPTIONS = STATUS_ORDER.map((s) => ({ value: s, label: statusMeta(s).label }));

const AdminBookingsPage = () => {
  const { toast } = useToast();
  const { bookings, setBookings, partners, loading, reload, exportToExcel } = useAdminBookings();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<AdminBooking | null>(null);
  const [dispatch, setDispatch] = useState<AdminBooking | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${b.tracking_id || ""} ${b.customer_name || ""} ${b.customer_phone || ""} ${b.pickup_location} ${b.delivery_location || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bookings, search, statusFilter]);

  const applyPatch = (id: string, patch: Partial<AdminBooking>) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setDetail((d) => (d && d.id === id ? { ...d, ...patch } : d));
    setDispatch((d) => (d && d.id === id ? { ...d, ...patch } : d));
  };

  const updateStatus = async (booking: AdminBooking, newStatus: string) => {
    setUpdatingId(booking.id);
    const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", booking.id);
    setUpdatingId(null);
    if (error) {
      toast({ title: "Status not changed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Status updated", description: `${shortBookingCode(booking)} → ${statusMeta(newStatus).label}` });
    applyPatch(booking.id, { status: newStatus });
  };

  const partnerName = (id: string | null) =>
    id ? partners.find((p) => p.id === id)?.full_name ?? null : null;

  return (
    <div>
      <AdminPageHeader eyebrow="Operations" title="Bookings & Dispatch">
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportToExcel(filtered)} disabled={filtered.length === 0}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export to Excel
        </Button>
      </AdminPageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <Input
            placeholder="Search tracking ID, customer, phone or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Bags</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Loading bookings…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No bookings match this view.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(b)}
                  >
                    <TableCell className="font-mono text-sm whitespace-nowrap">{shortBookingCode(b)}</TableCell>
                    <TableCell className="min-w-[150px]">
                      <div className="text-sm font-medium">{b.customer_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{b.customer_phone || "No phone"}</div>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="text-sm truncate">{b.pickup_location}</div>
                      <div className="text-xs text-muted-foreground truncate">→ {b.delivery_location || "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <div>Pickup {format(new Date(b.pickup_date), "dd MMM")}</div>
                      <div className="text-xs text-muted-foreground">Drop {format(new Date(b.drop_off_date), "dd MMM")}</div>
                    </TableCell>
                    <TableCell className="font-medium">{b.number_of_bags}</TableCell>
                    <TableCell className="font-semibold">{formatInr(b.amount)}</TableCell>
                    <TableCell>
                      <StatusPill status={b.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetail(b);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Booking detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetail(null)} />
          <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-card shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">Booking detail</p>
                <h2 className="text-xl font-extrabold font-mono">{shortBookingCode(detail)}</h2>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Close booking details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-sm">
              <BookingHandover bookingId={detail.id} role="admin" />
              <div className="flex items-center justify-between gap-3">
                <StatusPill status={detail.status} />
                <Select
                  value={detail.status}
                  onValueChange={(v) => updateStatus(detail, v)}
                  disabled={updatingId === detail.id}
                >
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" /> Customer
                </h3>
                <div className="space-y-1.5 text-muted-foreground">
                  <div>{detail.customer_name || "—"}</div>
                  <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /><span className="break-all">{detail.customer_email || "—"}</span></div>
                  <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{detail.customer_phone || "—"}</div>
                  <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5" /><span>{detail.customer_address || "—"}</span></div>
                  <div className="flex items-center gap-1.5 text-xs"><Hash className="w-3 h-3" /><span className="font-mono break-all">{detail.user_id}</span></div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Locations & schedule
                </h3>
                <div className="space-y-1.5 text-muted-foreground">
                  <div><span className="font-medium text-foreground">Pickup:</span> {detail.pickup_location}</div>
                  <div><span className="font-medium text-foreground">Delivery:</span> {detail.delivery_location || "—"}</div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Pickup {format(new Date(detail.pickup_date), "dd MMM yyyy")}
                      {detail.pickup_time ? ` · ${detail.pickup_time}` : ""} · Drop {format(new Date(detail.drop_off_date), "dd MMM yyyy")}
                      {detail.delivery_time ? ` · ${detail.delivery_time}` : ""}
                    </span>
                  </div>
                  <div><span className="font-medium text-foreground">Bags:</span> {detail.number_of_bags} · <span className="font-medium text-foreground">Amount:</span> {formatInr(detail.amount)}</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Send className="w-4 h-4" /> Delivery partner
                </h3>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-muted-foreground">
                    {partnerName(detail.assigned_partner_id) || "No partner assigned yet."}
                  </span>
                  <Button size="sm" onClick={() => setDispatch(detail)}>
                    <Send className="w-4 h-4 mr-1.5" />
                    Dispatch
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {dispatch && (
        <DispatchPartnerModal
          bookingId={dispatch.id}
          bookingLabel={shortBookingCode(dispatch)}
          currentPartnerId={dispatch.assigned_partner_id}
          onClose={() => setDispatch(null)}
          onAssigned={(partnerId) => applyPatch(dispatch.id, { assigned_partner_id: partnerId })}
        />
      )}
    </div>
  );
};

export default AdminBookingsPage;
