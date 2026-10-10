/** Plain class strings, importable from server and client components alike. */
const base = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition-[background,color,border-color,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100";
export const btn = {
  primary: `${base} bg-green text-white hover:bg-green-strong`,
  secondary: `${base} border border-line bg-surface text-ink hover:border-ink/40`,
  danger: `${base} bg-oxblood text-white hover:brightness-110`,
  /** For night slabs. */
  light: `${base} bg-white text-night hover:bg-white/85`,
  ghostNight: `${base} border border-white/35 bg-white/[0.06] text-white hover:border-white/70 hover:bg-white/10`,
  link: "text-[15px] text-green underline decoration-green/30 underline-offset-4 hover:decoration-green",
};
