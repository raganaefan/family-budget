// app/(app)/settings/page.tsx
import CategoryManager from "./CategoryManager";
import HouseholdSettings from "./HouseholdSettings";
import InviteMemberForm from "./InviteMemberForm";
import PaymentSourceManager from "./PaymentSourceManager"; // 1. IMPORT
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
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
      <PaymentSourceManager /> {/* 2. TAMBAHKAN DI SINI */}
      <InviteMemberForm />
    </div>
  );
}
