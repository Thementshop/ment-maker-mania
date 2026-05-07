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
  onBypassApplied?: (result: { priceId: string; quantity?: number | null }) => Promise<void> | void;
  onClose: () => void;
}

export function StripeCheckoutDialog({ open, priceId, userId, customerEmail, onBypassApplied, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [bypassResult, setBypassResult] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    if (open && priceId) {
      setError(null);
      setBypassResult(null);
      setClientSecret(null);
      setIsPreparing(true);
    }
  }, [open, priceId]);

  useEffect(() => {
    let cancelled = false;

    const prepareCheckout = async () => {
      if (!open || !priceId) return;

      try {
        setIsPreparing(true);
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

        if (cancelled) return;

        if (invokeError) {
          setIsPreparing(false);
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
          return;
        }

        if (data?.bypassApplied) {
          setIsPreparing(false);
          if (onBypassApplied) {
            void Promise.resolve(
              onBypassApplied({ priceId, quantity: (data.quantity as number | null | undefined) ?? null })
            ).catch((callbackError) => {
              console.error("Bypass completion failed:", callbackError);
            });
          } else {
            const grantedLabel =
              priceId === "mint_boost"
                ? "25 mints were added to your jar for preview testing."
                : priceId === "pause_tokens_unlimited_year"
                ? "Unlimited Pause Tokens were enabled for preview testing."
                : `${data.quantity ?? "Your"} Pause Tokens were added for preview testing.`;
            setBypassResult(grantedLabel);
          }
          return;
        }

        if (!data?.clientSecret) {
          setIsPreparing(false);
          setError("Couldn't open checkout");
          return;
        }

        const rawClientSecret = data.clientSecret as string;
        const resolvedClientSecret = rawClientSecret.includes("%")
          ? decodeURIComponent(rawClientSecret)
          : rawClientSecret;
        setClientSecret(resolvedClientSecret);
        setIsPreparing(false);
      } catch (err) {
        if (!cancelled) {
          setIsPreparing(false);
          setError(err instanceof Error ? err.message : "Couldn't open checkout");
        }
      }
    };

    void prepareCheckout();

    return () => {
      cancelled = true;
    };
  }, [open, priceId, userId, customerEmail, onBypassApplied]);

  const options = useMemo(() => {
    if (!clientSecret) return null;
    return { clientSecret };
  }, [clientSecret]);

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
          ) : open && priceId && isPreparing && !clientSecret ? (
            <div className="p-6 text-sm text-center text-muted-foreground">Preparing checkout…</div>
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
