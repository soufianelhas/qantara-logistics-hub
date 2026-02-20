import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * If no shipment_id is available, recover the most recent incomplete shipment.
 * Returns { shipmentId, shipment, loading }.
 */
export function useShipmentRecovery(explicitId: string | null, requiredStatuses: ("Draft" | "Calculated" | "Filed" | "Port-Transit" | "Delivered")[] = ["Draft", "Calculated"]) {
  const [shipmentId, setShipmentId] = useState<string | null>(explicitId);
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    if (explicitId) {
      setShipmentId(explicitId);
      return;
    }

    const recover = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("shipments")
          .select("*")
          .eq("user_id", user.id)
          .in("status", requiredStatuses)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setShipmentId(data.id);
          setShipment(data);
          setRecovered(true);
        }
      } catch (err) {
        console.warn("Shipment recovery failed:", err);
      } finally {
        setLoading(false);
      }
    };

    recover();
  }, [explicitId]);

  return { shipmentId, shipment, loading, recovered, setShipmentId };
}
