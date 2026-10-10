import { Slab } from "../ui";

function Ref({ n }: { n: number }) {
  return <sup><a href={`#source-${n}`} className="ml-0.5 font-mono text-[0.45em] text-green no-underline hover:underline" aria-label={`Source ${n}`}>{n}</a></sup>;
}

export default function Statement() {
  return (
    <Slab className="mt-[var(--inset)]">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:px-10 sm:py-28">
        <p className="headline text-[28px] text-ink sm:text-[44px]">
          A blockchain can&apos;t tell someone who is gone from someone who is quiet. So between 2.3 and 3.7 million
          bitcoin are lost for good.<Ref n={1} />
        </p>
        <p className="mx-auto mt-8 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-[19px]">
          Stellar now holds more than $3.9 billion in tokenized real-world assets,<Ref n={2} /> and none of the inheritance tools
          built for Bitcoin or Ethereum cover it.<Ref n={3} /> The options today are to share a seed phrase, write it into a will,
          or lose everything.
        </p>
      </div>
    </Slab>
  );
}
