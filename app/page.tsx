import { FinalCta, LimitsFaq } from "@/components/landing/Closing";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import LivePreview from "@/components/landing/LivePreview";
import NoCrypto from "@/components/landing/NoCrypto";
import Protocol from "@/components/landing/Protocol";
import Statement from "@/components/landing/Statement";

export default function Home() {
  return (
    <main>
      <Hero />
      <Statement />
      <HowItWorks />
      <LivePreview />
      <NoCrypto />
      <Protocol />
      <LimitsFaq />
      <FinalCta />
    </main>
  );
}
