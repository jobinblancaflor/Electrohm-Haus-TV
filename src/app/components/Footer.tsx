export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-10 md:flex-row md:items-end md:justify-between md:px-8">
        <div className="max-w-xl">
          <p className="font-display text-2xl leading-none font-extrabold tracking-tight uppercase">
            Electrohm <span className="text-amber">Haus TV</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            We don't host any streams. The channel list comes from the open{' '}
            <a
              href="https://github.com/iptv-org/iptv"
              target="_blank"
              rel="noreferrer"
              className="text-paper underline decoration-line underline-offset-4 hover:decoration-amber"
            >
              iptv-org
            </a>{' '}
            project, and each broadcaster decides what plays where. Some channels are geo-blocked or off air.
          </p>
        </div>
        <p className="font-mono text-[11px] tracking-wider text-dim uppercase">© 2026 Electrohm Haus TV</p>
      </div>
    </footer>
  );
}
