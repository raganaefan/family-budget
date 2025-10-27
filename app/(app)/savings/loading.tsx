// app/(app)/savings/loading.tsx
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Skeleton untuk "Kembali" */}
      <div className="h-5 w-32 rounded bg-gray-200" />
      {/* Skeleton Header */}
      <div className="h-10 w-3/4 rounded bg-gray-200" />
      <div className="h-6 w-1/2 rounded bg-gray-200" />
      {/* Skeleton Kartu */}
      <div className="h-32 rounded-lg bg-gray-200" />
      <div className="h-32 rounded-lg bg-gray-200" />
    </div>
  );
}
