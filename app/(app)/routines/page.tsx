// app/(app)/routines/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RoutinesClient from "./routines-client";

type HouseholdData = { id: string; name: string; payday_start: number };
type MembershipWithHousehold = {
  households: HouseholdData[] | HouseholdData | null;
};

export const dynamic = "force-dynamic";

export default async function RoutinesPage({
  searchParams,
}: {
  searchParams: Promise<{ household?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // 1) ambil household via memberships (sama seperti expenses)
  const { data: membership, error: membershipErr } = await supabase
    .from("memberships")
    .select("households(id, name, payday_start)")
    .eq("user_id", user.id)
    .single<MembershipWithHousehold>();

  if (membershipErr || !membership?.households) {
    console.error("Error fetching membership/household:", membershipErr);
    return <div>Gagal memuat data household. Silakan login ulang.</div>;
  }

  const householdObj = Array.isArray(membership.households)
    ? membership.households[0]
    : membership.households;

  if (!householdObj?.id) {
    return <div>Gagal memuat data household (data null).</div>;
  }

  // 2) izinkan override via query ?household=... kalau kamu butuh multi-HH
  const raw = params?.household ?? householdObj.id;
  const householdId = (raw ?? "").split("=")[0]; // sanitasi kalau ada "=UUID" nyasar

  return (
    <RoutinesClient
      householdId={householdId}
      householdName={householdObj.name}
    />
  );
}
