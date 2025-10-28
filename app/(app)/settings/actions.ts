// app/(app)/settings/actions.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server"; // Pakai action client untuk cek role

// Tipe untuk hasil kembalian
type ActionResult = {
  ok: boolean;
  message: string;
};

export async function inviteMemberAction(
  householdId: string,
  formData: FormData
): Promise<ActionResult> {
  // Tambah return type Promise<ActionResult>

  const emailRaw = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!emailRaw) return { ok: false, message: "Email wajib diisi." };

  const supabase = await createClient(); // Client untuk cek auth & role

  // 1. Dapatkan user ID si pengundang (Admin)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Anda harus login." };

  // 2. Cek apakah si pengundang adalah Admin household ini
  const { data: roleData, error: roleError } = await supabase
    .from("memberships")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .single();

  if (roleError || roleData?.role !== "admin") {
    return { ok: false, message: "Hanya admin yang bisa mengundang anggota." };
  }

  // 3. Cek apakah email sudah jadi member
  // Kita perlu Supabase Admin Client karena perlu cek auth.users
  const { data: existingUser, error: findUserError } = await supabaseAdmin
    .from("users") // Query tabel auth.users
    .select("id, email")
    .eq("email", emailRaw)
    .single();

  if (existingUser) {
    // Jika user sudah ada, cek apakah dia sudah jadi member household ini
    const { data: existingMembership, error: checkMemberError } = await supabase
      .from("memberships")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", existingUser.id)
      .maybeSingle(); // maybeSingle: bisa null jika belum jadi member

    if (checkMemberError) {
      console.error("Error checking existing membership:", checkMemberError);
      return {
        ok: false,
        message: `Gagal memeriksa keanggotaan: ${checkMemberError.message}`,
      };
    }
    if (existingMembership) {
      return {
        ok: false,
        message: `Pengguna ${emailRaw} sudah menjadi anggota household ini.`,
      };
    }
  }

  // 4. Masukkan data undangan ke tabel 'invitations'
  const { error: insertInviteError } = await supabase
    .from("invitations")
    .insert({
      household_id: householdId,
      invited_by_user_id: user.id, // ID Admin yg mengundang
      invited_user_email: emailRaw,
      status: "pending",
    });

  // Handle jika undangan sudah ada (unique constraint)
  if (insertInviteError && insertInviteError.code === "23505") {
    // Kode error unique violation
    console.log(
      `Pending invitation already exists for ${emailRaw} in household ${householdId}`
    );
    // Kita bisa lanjutkan untuk kirim ulang email
  } else if (insertInviteError) {
    console.error("Error inserting invitation:", insertInviteError);
    return {
      ok: false,
      message: `Gagal menyimpan data undangan: ${insertInviteError.message}`,
    };
  }

  // 5. Kirim email undangan via Admin API
  const { data: inviteData, error: emailError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(emailRaw, {
      // Arahkan ke halaman konfirmasi/selamat datang khusus (opsional)
      // redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm-invite`,
      // Atau tetap ke callback biasa jika tidak perlu halaman khusus
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    });

  if (emailError) {
    // Jika email gagal, coba hapus undangan yang baru dibuat (opsional)
    // await supabase.from('invitations').delete().match({ household_id: householdId, invited_user_email: emailRaw, status: 'pending' });
    console.error("Error sending invite email:", emailError);
    return {
      ok: false,
      message: `Gagal mengirim email undangan: ${emailError.message}`,
    };
  }

  // 6. Kembalikan pesan sukses
  return { ok: true, message: `Undangan berhasil dikirim ke ${emailRaw}.` };
}
