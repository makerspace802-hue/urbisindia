export function Footer() {
  return (
    <footer className="border-t-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-4 py-6 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 text-center">
        <p className="text-sm font-black uppercase tracking-wide text-[var(--nb-text)]">
          Made by Pratyush Dhote &amp; Avyan Koranne, Bilabong High
          International School, Bhopal
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--nb-text-dim)]">
          URBIS India · Smart City Management Platform
        </p>
      </div>
    </footer>
  );
}
