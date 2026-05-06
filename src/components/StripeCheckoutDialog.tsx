import { useEffect, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  priceId: string | null;
  userId?: string;
  customerEmail?: string;
  onClose: () => void;
}

export function StripeCheckoutDialog({ open, priceId, userId, customerEmail, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  // Force-remount Provider on each new priceId so clientSecret can change
  useEffect(() => {
    if (open && priceId) {
      setError(null);
      setKey((k) => k + 1);
    }
  }, [open, priceId]);

  const options = useMemo(() => {
    if (!open || !priceId) return null;
    return {
      fetchClientSecret: async (): Promise<string> => {
        const returnUrl = `${window.location.origin}/store?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
        const { data, error: invokeError } = await supabase.functions.invoke("create-checkout", {
          body: {
            priceId,
            userId,
            customerEmail,
            returnUrl,
            environment: getStripeEnvironment(),
          },
        });
        if (invokeError) {
          // Friendly message for the monthly Mint Boost block
          const msg = (invokeError as any)?.context?.body || invokeError.message;
          if (typeof msg === "string" && msg.includes("mint_boost_already_purchased_this_month")) {
            setError("You've already boosted your jar this month!");
          } else {
            setError(invokeError.message || "Couldn't open checkout");
          }
          throw invokeError;
        }
        if (!data?.clientSecret) {
          setError("Couldn't open checkout");
          throw new Error("No clientSecret returned");
        }
        return data.clientSecret as string;
      },
    };
  }, [open, priceId, userId, customerEmail]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>
        <div className="p-2">
          {error ? (
            <div className="p-6 text-sm text-destructive text-center">{error}</div>
          ) : options ? (
            <EmbeddedCheckoutProvider key={key} stripe={getStripe()} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
