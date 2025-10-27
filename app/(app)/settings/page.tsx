// app/(app)/settings/page.tsx
import { createClient } from "@/lib/supabase/server";
import CategoryManager from "./CategoryManager";
import HouseholdSettings from "./HouseholdSettings";
import InviteMemberForm from "./InviteMemberForm";
import PaymentSourceManager from "./PaymentSourceManager";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // Ambil household_id saja (menghindari isu array vs object)
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("household_id")
    .eq("user_id", user.id)
    .single();

  if (error || !membership?.household_id) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-red-600">Gagal memuat household_id.</p>
      </div>
    );
  }

  const householdId = membership.household_id as string;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900">Pengaturan</h1>

      <HouseholdSettings />
      <CategoryManager />
      <PaymentSourceManager />
      {/* ✅ Kirim householdId yang diwajibkan */}
      <InviteMemberForm householdId={householdId} />
    </div>
  );
}
