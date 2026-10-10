import { Container } from "../ui";

function Ref({ n }: { n: number }) {
  return <sup><a href={`#source-${n}`} className="ml-0.5 font-mono text-[0.5em] text-green no-underline hover:underline" aria-label={`Source ${n}`}>{n}</a></sup>;
}

export default function Statement() {
  return (
    <section aria-labelledby="problem-title" className="border-t border-line">
      <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <h2 id="problem-title" className="headline text-[32px] sm:text-[44px]">Keys die with their owners.</h2>
        <div className="space-y-5 text-[18px] leading-relaxed text-muted">
          <p>
            A blockchain can&apos;t tell someone who is gone from someone who is quiet. That&apos;s why an estimated 2.3 to 3.7
            million bitcoin are lost for good.<Ref n={1} />
          </p>
          <p>
            Stellar now holds more than $3.9 billion in tokenized real-world assets,<Ref n={2} /> and none of the inheritance
            tools built for Bitcoin or Ethereum cover it.<Ref n={3} /> Today the options are to share a seed phrase, write it
            into a will, or lose everything.
          </p>
        </div>
      </Container>
    </section>
  );
}
