import {
  admin,
  stripe,
  json,
  corsHeaders,
  requireUser,
  liveSubscription,
} from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Metodă neacceptată" }, 405);
  }

  try {
    const user = await requireUser(req);
    if (!user) {
      return json(req, { error: "Neautentificat" }, 401);
    }

    // Only Stripe subscriptions in a live state can be resumed.
    const localSub = await liveSubscription(user.id);

    if (!localSub?.provider_subscription_id) {
      return json(
        req,
        { error: "Nu ai un abonament Stripe care poate fi reactivat" },
        404,
      );
    }

    if (!localSub.cancel_at_period_end) {
      return json(
        req,
        { error: "Abonamentul nu are anularea programată" },
        409,
      );
    }

    // Stripe remains the source of truth. Retrieve the current object before
    // changing it, so stale local state cannot resume an already-ended plan.
    const current = await stripe.subscriptions.retrieve(
      localSub.provider_subscription_id,
    );

    if (!["active", "trialing", "past_due"].includes(current.status)) {
      return json(
        req,
        { error: "Abonamentul nu mai poate fi reactivat. Alege un plan nou." },
        409,
      );
    }

    if (!current.cancel_at_period_end) {
      // Stripe is already resumed; repair the local state idempotently.
      const item = current.items.data[0] as any;
      const periodEnd =
        (current as any).current_period_end ?? item?.current_period_end;

      const { error } = await admin
        .from("subscriptions")
        .update({
          cancel_at_period_end: false,
          canceled_at: null,
          ...(periodEnd
            ? { expires_at: new Date(periodEnd * 1000).toISOString() }
            : {}),
        })
        .eq("id", localSub.id)
        .eq("user_id", user.id);

      if (error) throw error;

      return json(req, { ok: true, already_resumed: true });
    }

    const resumed = await stripe.subscriptions.update(current.id, {
      cancel_at_period_end: false,
    });

    const item = resumed.items.data[0] as any;
    const periodEnd =
      (resumed as any).current_period_end ?? item?.current_period_end;

    const { error } = await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        canceled_at: null,
        ...(periodEnd
          ? { expires_at: new Date(periodEnd * 1000).toISOString() }
          : {}),
      })
      .eq("id", localSub.id)
      .eq("user_id", user.id);

    if (error) {
      // The Stripe update has succeeded. The subscription.updated webhook
      // will retry the local synchronization; surface an error for visibility.
      console.error(
        "resume-subscription: Stripe updated but Supabase sync failed",
        resumed.id,
        error,
      );
      return json(
        req,
        {
          error:
            "Abonamentul a fost reactivat în Stripe, dar sincronizarea contului întârzie. Reîncarcă pagina în câteva momente.",
        },
        503,
      );
    }

    return json(req, { ok: true });
  } catch (error) {
    console.error("resume-subscription failed", error);
    return json(
      req,
      { error: "Nu am putut reactiva abonamentul. Încearcă din nou." },
      500,
    );
  }
});