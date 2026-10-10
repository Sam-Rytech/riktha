// Plain class-name strings shared by server and client components.
// They must live outside "use client" modules: a server component importing a non-component value
// from a client module receives a client reference, not the string.

const base = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition-[background,color,border-color,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100";
export const btn = {
  primary: `${base} bg-green text-white hover:bg-green-strong`,
  secondary: `${base} border border-line bg-surface text-ink hover:border-ink/40`,
  danger: `${base} bg-oxblood text-white hover:brightness-110`,
  /** For night slabs. */
  light: `${base} bg-white text-night hover:bg-white/85`,
  ghostNight: `${base} border border-white/20 text-white hover:border-white/50`,
  link: "text-[15px] text-green underline decoration-green/30 underline-offset-4 hover:decoration-green",
};

/** The one grid: header, sections and footer all share these edges. */
export const containerCls = "mx-auto w-full max-w-[1200px] px-6 sm:px-10";

export const inputCls = "w-full rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-3 text-[15px] outline-none transition-colors placeholder:text-muted/60 focus:border-green aria-[invalid=true]:border-oxblood";
