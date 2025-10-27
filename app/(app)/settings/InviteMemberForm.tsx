// app/(app)/settings/InviteMemberForm.tsx
"use client";
import { useState, useTransition } from "react";
import { inviteMemberAction } from "./actions";

export default function InviteMemberForm({
  householdId,
}: {
  householdId: string;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Bind householdId agar bisa dipakai di server action
  const inviteWithHousehold = inviteMemberAction.bind(null, householdId);

  return (
    <div className="rounded-lg bg-white p-6 shadow-lg">
      <h3 className="text-lg font-medium text-gray-900">Undang Anggota Baru</h3>

      <form
        action={async (formData: FormData) => {
          setMessage("");
          setError("");
          startTransition(async () => {
            const res = await inviteWithHousehold(formData);
            if (res.ok) setMessage(res.message);
            else setError(res.message);
          });
        }}
        className="mt-4 flex gap-4"
      >
        <input
          type="email"
          name="email" // <-- penting untuk FormData
          placeholder="Email anggota baru..."
          required
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Mengundang..." : "Undang"}
        </button>
      </form>

      {message && <p className="mt-3 text-sm text-green-600">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
