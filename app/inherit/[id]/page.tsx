import { Suspense } from "react";
import InheritClient from "@/components/InheritClient";

// The plan id is runtime data, so the client part streams in behind a Suspense boundary (Cache Components).
export default function InheritPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl px-4 py-10 text-muted sm:px-6">Loading…</main>}>
      <InheritClient />
    </Suspense>
  );
}
