// app/(app)/reports/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { startOfMonth, addMonths, parseISO, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import ReportsClient from "./reports-client";

export const dynamic = "force-dynamic";

function normalizeMonth(raw?: string) {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7) + "-01";
  if (/^\d{4}-\d{2}$/.test(s)) return s + "-01";
  return undefined;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("households(id, name, payday_start)")
    .eq("user_id", user.id)
    .single();

  const raw = membership?.households as any;
  const household = Array.isArray(raw) ? raw[0] : raw;
  if (!household) return redirect("/dashboard");

  // tentukan bulan
  const monthFromQuery = normalizeMonth(params?.month);
  let selectedMonthISO: string;
  if (monthFromQuery) {
    selectedMonthISO = monthFromQuery;
  } else {
    const today = new Date();
    const calendarMonthStart = startOfMonth(today);
    selectedMonthISO = format(calendarMonthStart, "yyyy-MM-01");
  }

  // panggil RPC
  const [trendRes, catRes, weeklyRes, merchRes, srcRes] = await Promise.all([
    supabase.rpc("report_monthly_trend_by_month", {
      p_household_id: household.id,
      p_month_from: selectedMonthISO, // ← STRING, bukan Date
      p_months_back: 5,
    }),
    supabase.rpc("report_category_breakdown_by_month", {
      p_household_id: household.id,
      p_month: selectedMonthISO, // ← STRING
    }),
    supabase.rpc("report_weekly_spending_paycycle", {
      p_household_id: household.id,
      p_month: selectedMonthISO, // ← STRING
    }),
    supabase.rpc("report_top_merchants_by_month", {
      p_household_id: household.id,
      p_month: selectedMonthISO, // ← STRING
      p_limit: 7,
    }),
    supabase.rpc("report_payment_sources_by_month", {
      p_household_id: household.id,
      p_month: selectedMonthISO, // ← STRING
    }),
  ]);

  const trend = trendRes.data ?? [];
  const categories = catRes.data ?? [];
  const weekly = weeklyRes.data ?? [];
  const merchants = merchRes.data ?? [];
  const sources = srcRes.data ?? [];

  return (
    <ReportsClient
      selectedMonthISO={selectedMonthISO}
      trend={trend}
      categories={categories}
      weekly={weekly}
      merchants={merchants}
      sources={sources}
      householdName={household.name}
    />
  );
}
