import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY");
export const stripe = new Stripe(secretKey);
export const SITE = (Deno.env.get("SITE_URL") ?? "https://www.submed.ro").replace(/\/$/, "");
export const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
export const PRICES: Record<string, string | undefined> = { basic: Deno.env.get("STRIPE_PRICE_BASIC"), premium: Deno.env.get("STRIPE_PRICE_PREMIUM") };
export const tierFromPrice = (id?: string) => Object.entries(PRICES).find(([, price]) => price && price === id)?.[0];
const ALLOWED = new Set([
  SITE,
  "https://submed.ro",
  "https://www.submed.ro",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5501",
  "http://127.0.0.1:5501",
]);
export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : SITE, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}
export async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}
export async function getOrCreateCustomer(user: { id: string; email?: string }) {
  const { data, error } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (data?.stripe_customer_id) return data.stripe_customer_id as string;
  const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } }, { idempotencyKey: "submed-customer-" + user.id });
  const { error: saveError } = await admin.from("billing_customers").upsert({ user_id: user.id, stripe_customer_id: customer.id });
  if (saveError) throw saveError;
  return customer.id;
}
export async function liveSubscription(userId: string) {
  const { data, error } = await admin.from("subscriptions").select("*").eq("user_id", userId).eq("provider", "stripe").in("status", ["active", "trialing", "past_due"]).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
