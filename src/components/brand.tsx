export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-md shadow-indigo-600/25">
        <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="7" y="13" width="3.4" height="3.4" rx="0.9" fill="currentColor" />
        </svg>
      </span>
      <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-t1"}`}>Bookly</span>
    </span>
  );
}

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="brand-gradient relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between p-12">
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <Logo light />
        <div>
          <h2 className="text-3xl font-bold leading-tight text-white">
            Turn your calendar into a booking machine.
          </h2>
          <p className="mt-3 text-white/80">
            Define your services, set your hours, share your link — and let clients book themselves.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-white/85">
          {[
            "Unlimited services & weekly hours",
            "Smart slots — no double booking",
            "Shareable booking URL for clients",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
