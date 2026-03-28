import { InvestmentCalculator } from '@/components/investment-calculator';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Inversión en renta · México</p>
        <h1 className="text-2xl font-bold text-slate-900 md:text-4xl">Calculadora profesional de compra con hipoteca</h1>
        <p className="max-w-3xl text-sm text-slate-600 md:text-base">
          Evalúa flujo mensual, amortización de deuda, plusvalía y patrimonio neto para decidir si una propiedad
          conviene como inversión en renta.
        </p>
      </header>
      <InvestmentCalculator />
    </main>
  );
}
