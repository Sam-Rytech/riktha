import { Suspense } from "react";
import InheritClient from "@/components/InheritClient";

// The plan id is runtime data, so the client part streams in behind a Suspense boundary (Cache Components).
export default function InheritPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-[1200px] px-6 pt-12 text-muted sm:px-10">Loading…</main>}>
      <InheritClient />
    </Suspense>
  );
}
