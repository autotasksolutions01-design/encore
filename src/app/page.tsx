export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-5xl font-bold text-brand-500 mb-4">Encore</h1>
      <p className="text-xl text-slate-400 max-w-lg">
        Conectá con músicos. Descubrí. Tocá.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/es/login"
          className="rounded-lg bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700 transition-colors"
        >
          Empezar
        </a>
        <a
          href="/es/discover"
          className="rounded-lg border border-slate-700 px-6 py-3 text-slate-300 font-medium hover:border-slate-500 hover:text-white transition-colors"
        >
          Descubrí músicos
        </a>
      </div>
    </main>
  );
}
