// app/(app)/reports/loading.tsx
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Skeleton untuk "Kembali" */}
      <div className="h-5 w-32 rounded bg-gray-200" />

      <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow-lg">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    </div>
  );
}
