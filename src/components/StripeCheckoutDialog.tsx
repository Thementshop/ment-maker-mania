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
  const [bypassResult, setBypassResult] = useState<string | null>(null);

  useEffect(() => {
    if (open && priceId) {
      setError(null);
      setBypassResult(null);
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
            allowSandboxBypass: true,
          },
        });
        if (invokeError) {
          const msg = (invokeError as any)?.context?.body || invokeError.message;
          if (typeof msg === "string" && msg.includes("mint_boost_already_purchased_this_month")) {
            setError("You've already boosted your jar this month!");
          } else if (typeof msg === "string" && msg.includes("sandbox_account_not_ready")) {
            setError("Your test payments account isn't fully ready yet, so checkout can't open right now.");
          } else if (typeof msg === "string" && msg.includes("live_account_not_ready")) {
            setError("Your payments account isn't ready for checkout yet.");
          } else {
            setError(invokeError.message || "Couldn't open checkout");
          }
          throw invokeError;
        }
        if (data?.bypassApplied) {
          const grantedLabel =
            priceId === "mint_boost"
              ? "25 mints were added to your jar for preview testing."
              : priceId === "pause_tokens_unlimited_year"
              ? "Unlimited Pause Tokens were enabled for preview testing."
              : `${data.quantity ?? "Your"} Pause Tokens were added for preview testing.`;
          setBypassResult(grantedLabel);
          throw new Error("preview_bypass_applied");
        }
        if (!data?.clientSecret) {
          setError("Couldn't open checkout");
          throw new Error("No clientSecret returned");
        }
        const rawClientSecret = data.clientSecret as string;
        const clientSecret = rawClientSecret.includes("%")
          ? decodeURIComponent(rawClientSecret)
          : rawClientSecret;
        return clientSecret;
      },
    };
  }, [open, priceId, userId, customerEmail]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>
        <div className="p-2 min-h-[400px]">
          {bypassResult ? (
            <div className="p-6 text-sm text-center space-y-4">
              <p>{bypassResult}</p>
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive text-center">{error}</div>
          ) : open && priceId && options ? (
            <EmbeddedCheckoutProvider key={priceId} stripe={getStripe()} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
