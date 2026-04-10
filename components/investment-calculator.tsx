'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { calculateInvestment, deriveLoanValues, getDefaultInputs, validateInputs, type CalculatorInputs } from '@/lib/finance';
import { formatCurrency, formatMonthsToYears } from '@/lib/format';

const FIELD_DEFINITIONS: Array<{ key: keyof CalculatorInputs; label: string; step?: string; help?: string }> = [
  { key: 'propertyPrice', label: 'Precio de la propiedad', step: '1000' },
  { key: 'downPayment', label: 'Enganche', step: '1000' },
  { key: 'loanAmount', label: 'Monto del crédito', step: '1000' },
  { key: 'annualRate', label: 'Tasa anual (%)', step: '0.1' },
  { key: 'loanTermYears', label: 'Plazo del crédito (años)', step: '1' },
  { key: 'monthlyMortgagePayment', label: 'Pago mensual estimado de hipoteca', step: '100' },
  { key: 'initialRent', label: 'Renta mensual inicial esperada', step: '100' },
  { key: 'annualRentGrowth', label: 'Incremento anual de renta (%)', step: '0.1' },
  {
    key: 'extraMonthlyPrincipal',
    label: 'Aportación mensual a capital',
    step: '100',
    help: 'Monto adicional que se paga directo al principal para acortar el plazo.'
  },
  {
    key: 'extraAnnualPrincipal',
    label: 'Aportación anual extraordinaria a capital',
    step: '1000',
    help: 'Pago adicional una vez por año para reducir deuda más rápido.'
  },
  {
    key: 'annualAppreciation',
    label: 'Plusvalía anual esperada (%)',
    step: '0.1',
    help: 'Incremento estimado del valor de la propiedad año con año.'
  },
  { key: 'monthlyExpenses', label: 'Gastos mensuales mantenimiento/vacancia/administración', step: '100' },
  { key: 'analysisHorizonYears', label: 'Horizonte de análisis (años)', step: '1' }
];

function exportCsv(rows: ReturnType<typeof calculateInvestment>['annualRows']): void {
  const headers = [
    'anio',
    'renta_mensual',
    'flujo_mensual',
    'deuda_base',
    'deuda_con_aportaciones',
    'valor_propiedad',
    'patrimonio_base',
    'patrimonio_con_aportaciones'
  ];

  const csvRows = rows.map((row) =>
    [
      row.year,
      row.rentMonthly.toFixed(2),
      row.cashFlowMonthly.toFixed(2),
      row.remainingDebtBase.toFixed(2),
      row.remainingDebtWithExtras.toFixed(2),
      row.propertyValue.toFixed(2),
      row.netWorthBase.toFixed(2),
      row.netWorthWithExtras.toFixed(2)
    ].join(',')
  );

  const content = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'proyeccion-inversion-inmobiliaria.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function InvestmentCalculator() {
  const defaults = useMemo(() => getDefaultInputs(), []);
  const [inputs, setInputs] = useState<CalculatorInputs>(defaults);

  useEffect(() => {
    const derived = deriveLoanValues(inputs);
    if (inputs.loanAmount === derived.loanAmount && inputs.monthlyMortgagePayment === derived.monthlyMortgagePayment) {
      return;
    }

    setInputs((prev) => ({
      ...prev,
      loanAmount: derived.loanAmount,
      monthlyMortgagePayment: derived.monthlyMortgagePayment
    }));
  }, [inputs]);

  const errors = useMemo(() => validateInputs(inputs), [inputs]);
  const result = useMemo(() => calculateInvestment(inputs), [inputs]);

  const fifthYear = result.annualRows.find((row) => row.year === 5) ?? result.annualRows[result.annualRows.length - 1];
  const tenthYear = result.annualRows.find((row) => row.year === 10) ?? result.annualRows[result.annualRows.length - 1];

  const chartData = result.annualRows.map((row) => ({
    year: row.year,
    deudaBase: Math.max(row.remainingDebtBase, 0),
    deudaConAportaciones: Math.max(row.remainingDebtWithExtras, 0),
    rentaMensual: row.rentMonthly,
    patrimonioBase: row.netWorthBase,
    patrimonioConAportaciones: row.netWorthWithExtras
  }));

  return (
    <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="card h-fit space-y-3">
        <h2 className="text-lg font-semibold">Entradas del análisis</h2>
        <p className="text-sm text-slate-600">Modelo pensado para créditos hipotecarios en México con estrategia de reducción de plazo.</p>

        <div className="grid gap-3">
          {FIELD_DEFINITIONS.map((field) => (
            <label key={field.key} className="text-sm">
              <span className="flex items-center gap-2 font-medium">
                {field.label}
                {field.help ? <span className="help" title={field.help}>?</span> : null}
              </span>
              <input
                className="input"
                type="number"
                step={field.step ?? '1'}
                value={inputs[field.key]}
                onChange={(event) =>
                  setInputs((prev) => ({
                    ...prev,
                    [field.key]: Number(event.target.value)
                  }))
                }
                readOnly={field.key === 'loanAmount' || field.key === 'monthlyMortgagePayment'}
                title={
                  field.key === 'loanAmount'
                    ? 'Se calcula automáticamente como precio de la propiedad menos enganche.'
                    : field.key === 'monthlyMortgagePayment'
                      ? 'Se calcula automáticamente con fórmula hipotecaria tradicional.'
                      : undefined
                }
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => setInputs(getDefaultInputs())}>
            Cargar caso ejemplo
          </button>
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={() => setInputs({ ...defaults, extraMonthlyPrincipal: 0, extraAnnualPrincipal: 0 })}
          >
            Resetear
          </button>
          <button
            className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-700"
            onClick={() => exportCsv(result.annualRows)}
          >
            Exportar CSV
          </button>
        </div>

        {errors.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">Corrige los siguientes campos:</p>
            <ul className="list-inside list-disc">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard title="Flujo mensual inicial" value={formatCurrency(result.initialMonthlyCashFlow)} help="Renta - hipoteca - gastos." />
          <MetricCard title="Flujo mensual año 5" value={formatCurrency(fifthYear.cashFlowMonthly)} />
          <MetricCard title="Flujo mensual año 10" value={formatCurrency(tenthYear.cashFlowMonthly)} />
          <MetricCard title="Tiempo estimado para liquidar" value={formatMonthsToYears(result.withExtras.payoffMonths)} />
          <MetricCard title="Reducción de plazo" value={formatMonthsToYears(result.reducedTermMonths)} />
          <MetricCard title="Patrimonio neto proyectado" value={formatCurrency(result.netWorthProjected)} help="Valor de mercado proyectado menos deuda restante." />
          <MetricCard title="Ahorro estimado en intereses" value={formatCurrency(result.interestSavings)} />
          <MetricCard title="Beneficio total estimado" value={formatCurrency(result.totalBenefitEstimated)} help="Ganancia neta acumulada de rentas después de hipoteca y gastos en el horizonte." />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Evolución de deuda restante">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="deudaBase" stroke="#ef4444" name="Sin aportaciones" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="deudaConAportaciones" stroke="#2563eb" name="Con aportaciones" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Evolución de renta mensual">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="rentaMensual" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Evolución de patrimonio neto">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="patrimonioBase" stroke="#f59e0b" name="Base" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="patrimonioConAportaciones" stroke="#2563eb" name="Con aportaciones" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="card space-y-4">
            <h3 className="text-base font-semibold">Comparativa de escenarios</h3>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <ScenarioSummary
                title="Escenario base"
                payoff={result.base.payoffMonths}
                interest={result.base.totalInterestPaid}
                debt={result.base.remainingDebtAtHorizon}
              />
              <ScenarioSummary
                title="Con aportaciones"
                payoff={result.withExtras.payoffMonths}
                interest={result.withExtras.totalInterestPaid}
                debt={result.withExtras.remainingDebtAtHorizon}
              />
            </div>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <h3 className="mb-3 text-base font-semibold">Tabla anual de proyección</h3>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2">Año</th>
                <th className="px-3 py-2">Renta mensual</th>
                <th className="px-3 py-2">Flujo mensual</th>
                <th className="px-3 py-2">Deuda restante (con aportaciones)</th>
                <th className="px-3 py-2">Valor propiedad</th>
                <th className="px-3 py-2">Patrimonio neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.annualRows.map((row) => (
                <tr key={row.year}>
                  <td className="px-3 py-2">{row.year}</td>
                  <td className="px-3 py-2">{formatCurrency(row.rentMonthly)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.cashFlowMonthly)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.remainingDebtWithExtras)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.propertyValue)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.netWorthWithExtras)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ title, value, help }: { title: string; value: string; help?: string }) {
  return (
    <article className="card">
      <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        {title}
        {help ? <span className="help" title={help}>?</span> : null}
      </p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </article>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="mb-2 text-base font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function ScenarioSummary({ title, payoff, interest, debt }: { title: string; payoff: number; interest: number; debt: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="font-semibold text-slate-800">{title}</p>
      <ul className="mt-2 space-y-1">
        <li>Liquidación estimada: <strong>{formatMonthsToYears(payoff)}</strong></li>
        <li>Intereses totales: <strong>{formatCurrency(interest)}</strong></li>
        <li>Deuda al horizonte: <strong>{formatCurrency(debt)}</strong></li>
      </ul>
    </article>
  );
}
