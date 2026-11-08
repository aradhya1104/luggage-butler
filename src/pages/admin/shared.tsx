import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useHandoverUpdates } from "@/hooks/useHandoverUpdates";

export interface AdminBooking {
  id: string;
  pickup_location: string;
  delivery_location: string | null;
  pickup_date: string;
  drop_off_date: string;
  pickup_time: string | null;
  delivery_time: string | null;
  number_of_bags: number;
  amount: number;
  status: string;
  tracking_id: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  assigned_partner_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
}

export interface PartnerLite {
  id: string;
  partner_code: string;
  full_name: string;
  mobile: string;
  vehicle_type: string;
  vehicle_number: string;
  availability_status: string;
  account_status: string;
}

// Friendly labels for the booking lifecycle. Values match the existing
// bookings.status values so tracking and partner flows keep working.
export const STATUS_META: Record<string, { label: string; pill: string }> = {
  pending: { label: "Booking Created", pill: "bg-amber-100 text-amber-800" },
  cod_pending: { label: "COD Pending", pill: "bg-slate-100 text-slate-700" },
  paid: { label: "Payment Confirmed", pill: "bg-blue-100 text-blue-700" },
  picked_up: { label: "Picked Up", pill: "bg-success/10 text-success" },
  in_storage: { label: "In Storage", pill: "bg-orange-100 text-orange-700" },
  in_transit: { label: "In Transit", pill: "bg-purple-100 text-purple-700" },
  delivered: { label: "Delivered", pill: "bg-emerald-100 text-emerald-700" },
  completed: { label: "Completed", pill: "bg-green-100 text-green-700" },
};

export const STATUS_ORDER = ["pending", "paid", "picked_up", "in_storage", "in_transit", "delivered", "completed"];

export const statusMeta = (s: string) =>
  STATUS_META[s] ?? { label: s.replace(/_/g, " "), pill: "bg-muted text-muted-foreground" };

export const StatusPill = ({ status }: { status: string }) => {
  const m = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${m.pill}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
};

export const AdminPageHeader = ({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent mb-1">{eyebrow}</p>
      <h1 className="text-2xl sm:text-[28px] font-extrabold text-foreground leading-tight">{title}</h1>
    </div>
    {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
  </div>
);

export const shortBookingCode = (b: { id: string; tracking_id: string | null }) =>
  b.tracking_id || `#${b.id.slice(0, 8).toUpperCase()}`;

export const formatInr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Loads all bookings with customer details plus the delivery partner roster.
// Shared by the overview, bookings and storage screens.
export const useAdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [partners, setPartners] = useState<PartnerLite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [bookingsRes, partnersRes] = await Promise.all([
      supabase.from("bookings").select("*").order("created_at", { ascending: false }),
      supabase
        .from("delivery_partners")
        .select("id, partner_code, full_name, mobile, vehicle_type, vehicle_number, availability_status, account_status")
        .order("full_name"),
    ]);

    const bookingsData = bookingsRes.data ?? [];
    setPartners((partnersRes.data ?? []) as PartnerLite[]);

    if (bookingsRes.error) {
      toast({ title: "Error", description: "Failed to load bookings", variant: "destructive" });
      setLoading(false);
      return;
    }

    const userIds = [...new Set(bookingsData.map((b) => b.user_id))];
    const [profilesRes, emailsRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id, full_name, phone, address").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; full_name: string | null; phone: string | null; address: string | null }[] }),
      userIds.length ? supabase.rpc("get_user_emails", { _user_ids: userIds }) : Promise.resolve({ data: [] as { user_id: string; email: string }[] }),
    ]);

    const profilesMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
    const emailsMap = new Map((emailsRes.data ?? []).map((e) => [e.user_id, e.email]));

    setBookings(
      bookingsData.map((b) => ({
        ...b,
        customer_name: profilesMap.get(b.user_id)?.full_name ?? null,
        customer_phone: profilesMap.get(b.user_id)?.phone ?? null,
        customer_address: profilesMap.get(b.user_id)?.address ?? null,
        customer_email: emailsMap.get(b.user_id) ?? null,
      }))
    );
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);
  useHandoverUpdates(() => { void load(); });

  const exportToExcel = (rows: AdminBooking[]) => {
    if (rows.length === 0) {
      toast({ title: "No data", description: "There are no bookings to export." });
      return;
    }
    const data = rows.map((b) => ({
      "Tracking ID": b.tracking_id || "",
      "Booking ID": b.id,
      "Customer Name": b.customer_name || "",
      "Customer Email": b.customer_email || "",
      "Customer Phone": b.customer_phone || "",
      "Customer Address": b.customer_address || "",
      "Pickup Location": b.pickup_location,
      "Delivery Location": b.delivery_location || "",
      "Pickup Date": b.pickup_date,
      "Drop Off Date": b.drop_off_date,
      "Pickup Time": b.pickup_time || "",
      "Delivery Time": b.delivery_time || "",
      "Number of Bags": b.number_of_bags,
      "Amount (INR)": b.amount,
      "Status": statusMeta(b.status).label,
      "Assigned Partner": partners.find((p) => p.id === b.assigned_partner_id)?.full_name || "",
      "Created At": format(new Date(b.created_at), "yyyy-MM-dd HH:mm:ss"),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    (ws as Record<string, unknown>)["!cols"] = Object.keys(data[0]).map((k) => ({
      wch: Math.max(k.length, ...data.map((r) => String(r[k as keyof typeof r] ?? "").length)) + 2,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");
    XLSX.writeFile(wb, `luggo-bookings-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`);
    toast({ title: "Exported", description: `${data.length} bookings exported to Excel.` });
  };

  return { bookings, setBookings, partners, loading, reload: load, exportToExcel };
};
