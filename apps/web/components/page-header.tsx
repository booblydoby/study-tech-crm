export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-8">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-yellow-400/15 bg-yellow-400/5 px-3 py-1 text-xs font-medium text-brand-yellow">
        Study Tech CRM
      </div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
        <span className="landing-gradient-text">{title}</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-white/50">{description}</p>
    </header>
  );
}
