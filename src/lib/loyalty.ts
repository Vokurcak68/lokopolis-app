import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// 1 Kč = 1 bod (zaokrouhleno dolů)
const POINTS_PER_CZK = 1;
// 100 bodů = 10 Kč sleva
const POINTS_VALUE_CZK = 0.1;

export async function getUserLoyaltyInfo(userId: string) {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("loyalty_points, loyalty_level_id")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  const { data: levels } = await supabase
    .from("loyalty_levels")
    .select("*")
    .order("min_points", { ascending: true });

  const currentLevel = levels?.find((l) => l.id === profile.loyalty_level_id) || levels?.[0] || null;
  const nextLevel = levels?.find((l) => l.min_points > (profile.loyalty_points || 0)) || null;

  return {
    points: profile.loyalty_points || 0,
    currentLevel,
    nextLevel,
    levels: levels || [],
    pointsValueCzk: Math.floor((profile.loyalty_points || 0) * POINTS_VALUE_CZK),
  };
}

export async function grantOrderPoints(userId: string, orderId: string, orderTotal: number, orderNumber: string) {
  const supabase = getServiceClient();

  // Get user's loyalty level for multiplier
  const info = await getUserLoyaltyInfo(userId);
  const multiplier = info?.currentLevel?.points_multiplier || 1.0;
  const basePoints = Math.floor(orderTotal * POINTS_PER_CZK);
  const points = Math.floor(basePoints * multiplier);

  if (points <= 0) return 0;

  // Insert point entry
  await supabase.from("loyalty_points").insert({
    user_id: userId,
    points,
    reason: "purchase",
    order_id: orderId,
    description: `Objednávka ${orderNumber}`,
  });

  // Update profile total
  const currentPoints = info?.points || 0;
  const newTotal = currentPoints + points;
  
  // Determine new level
  const { data: levels } = await supabase
    .from("loyalty_levels")
    .select("*")
    .lte("min_points", newTotal)
    .order("min_points", { ascending: false })
    .limit(1);

  await supabase.from("profiles").update({
    loyalty_points: newTotal,
    loyalty_level_id: levels?.[0]?.id || null,
  }).eq("id", userId);

  // Update order
  await supabase.from("shop_orders").update({ loyalty_points_earned: points }).eq("id", orderId);

  return points;
}

export async function redeemPoints(userId: string, points: number): Promise<{ discount: number } | { error: string }> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("loyalty_points")
    .eq("id", userId)
    .single();

  if (!profile || (profile.loyalty_points || 0) < points) {
    return { error: "Nemáte dostatek bodů" };
  }

  const discount = Math.floor(points * POINTS_VALUE_CZK);
  return { discount };
}

export async function applyPointsToOrder(
  userId: string,
  orderId: string,
  points: number,
  discount: number,
) {
  const supabase = getServiceClient();

  // Deduct points
  await supabase.from("loyalty_points").insert({
    user_id: userId,
    points: -points,
    reason: "redeem",
    order_id: orderId,
    description: `Uplatnění ${points} bodů (sleva ${discount} Kč)`,
  });

  // Update profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("loyalty_points")
    .eq("id", userId)
    .single();

  const newTotal = Math.max(0, (profile?.loyalty_points || 0) - points);

  // Recalculate level
  const { data: levels } = await supabase
    .from("loyalty_levels")
    .select("*")
    .lte("min_points", newTotal)
    .order("min_points", { ascending: false })
    .limit(1);

  await supabase.from("profiles").update({
    loyalty_points: newTotal,
    loyalty_level_id: levels?.[0]?.id || null,
  }).eq("id", userId);

  // Update order
  await supabase.from("shop_orders").update({
    loyalty_points_used: points,
    loyalty_discount: discount,
  }).eq("id", orderId);
}

export async function grantBonusPoints(userId: string, points: number, reason: string, description: string) {
  const supabase = getServiceClient();

  await supabase.from("loyalty_points").insert({
    user_id: userId,
    points,
    reason,
    description,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("loyalty_points")
    .eq("id", userId)
    .single();

  const newTotal = (profile?.loyalty_points || 0) + points;

  const { data: levels } = await supabase
    .from("loyalty_levels")
    .select("*")
    .lte("min_points", newTotal)
    .order("min_points", { ascending: false })
    .limit(1);

  await supabase.from("profiles").update({
    loyalty_points: newTotal,
    loyalty_level_id: levels?.[0]?.id || null,
  }).eq("id", userId);
}

export { POINTS_PER_CZK, POINTS_VALUE_CZK };
