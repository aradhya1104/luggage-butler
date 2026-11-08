import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Codes never travel over realtime; events cause a fresh authorized RPC read.
export function useHandoverUpdates(onUpdate: () => void, bookingId?: string) {
  const callback = useRef(onUpdate);
  callback.current = onUpdate;
  const { toast } = useToast();
  useEffect(() => {
    let active = true;
    const channel = supabase.channel(`handover-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "handover_notifications", ...(bookingId ? { filter: `booking_id=eq.${bookingId}` } : {}) }, ({ new: row }) => {
        callback.current();
        if (!bookingId && typeof row.message === "string") toast({ title: "Luggage handover", description: row.message });
      }).subscribe();
    const resume = () => { if (active && document.visibilityState === "visible") callback.current(); };
    const timer = window.setInterval(resume, 15000);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      void supabase.removeChannel(channel);
    };
  }, [bookingId, toast]);
}