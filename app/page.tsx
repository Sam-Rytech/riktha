import { FinalCta, LimitsFaq } from "@/components/landing/Closing";
import DarkHalf from "@/components/landing/DarkHalf";
import Hero from "@/components/landing/Hero";
import LivePreview from "@/components/landing/LivePreview";
import NoCrypto from "@/components/landing/NoCrypto";
import PinnedStory from "@/components/landing/PinnedStory";
import Statement from "@/components/landing/Statement";

export default function Home() {
  return (
    <main>
      <Hero />
      <Statement />
      <PinnedStory />
      <LivePreview />
      <NoCrypto />
      <DarkHalf />
      <LimitsFaq />
      <FinalCta />
    </main>
  );
}
