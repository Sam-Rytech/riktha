import Link from "next/link";

// Placeholder landing; the full page (problem, how it works, limits) is T4.3.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-4 py-20 sm:px-6">
      <p className="text-sm uppercase tracking-[0.2em] text-muted">Testnet preview</p>
      <h1 className="max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
        Your Stellar account, passed on to the person you choose.
      </h1>
      <p className="max-w-xl text-lg text-muted">
        Sign once. If you ever stop using your account, the Stellar network itself hands it to your heir,
        after a warning period you can cancel with one click. No custodian, no shared seed phrase.
      </p>
      <div>
        <Link href="/plan/new" className="inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-paper hover:bg-accent-strong">
          Create your plan
        </Link>
      </div>
    </main>
  );
}
