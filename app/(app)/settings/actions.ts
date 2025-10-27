// app/(app)/settings/actions.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server"; // anon server client, kalau mau panggil RPC

export async function inviteMemberAction(
  householdId: string,
  formData: FormData
) {
  const emailRaw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!emailRaw) return { ok: false, message: "Email wajib diisi." };

  // 1) Kirim email undangan via Admin API
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    emailRaw,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    }
  );
  if (error)
    return {
      ok: false,
      message: `Gagal mengirim email undangan: ${error.message}`,
    };

  // 2) Opsional: panggil RPC untuk menambah membership jika user sudah ada
  try {
    const supabase = await createClient(); // anon server-side
    await supabase.rpc("invite_member", {
      p_household_id: householdId,
      p_member_email: emailRaw,
    });
  } catch (_) {
    // boleh diabaikan; membership bisa ditambahkan saat user selesai registrasi (pakai trigger/worker)
  }

  return { ok: true, message: `Undangan dikirim ke ${emailRaw}.` };
}
