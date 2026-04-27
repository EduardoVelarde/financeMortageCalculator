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
import { calculateInvestment, deriveLoanValues, getDefaultInputs, validateInputs, type CalculatorInputs, type ScenarioName } from '@/lib/finance';
import { formatCurrency, formatMonthsToYears } from '@/lib/format';

const MAIN_FIELDS: Array<{ key: keyof CalculatorInputs; label: string; step?: string; help?: string }> = [
  { key: 'propertyPrice', label: 'Precio de la propiedad', step: '1000' },
  { key: 'downPayment', label: 'Enganche', step: '1000' },
  { key: 'loanAmount', label: 'Monto del crédito', step: '1000' },
  { key: 'annualRate', label: 'Tasa anual (%)', step: '0.1' },
  { key: 'loanTermYears', label: 'Plazo del crédito (años)', step: '1' },
  { key: 'monthlyMortgagePayment', label: 'Pago mensual estimado de hipoteca', step: '100' },
  { key: 'annualRentGrowth', label: 'Incremento anual de renta (%)', step: '0.1' },
  { key: 'annualAppreciation', label: 'Plusvalía anual esperada (%)', step: '0.1' },
  { key: 'monthlyExpenses', label: 'Gastos mensuales base', step: '100' },
  { key: 'analysisHorizonYears', label: 'Horizonte de análisis (años)', step: '1' }
];

const ADVANCED_FIELDS: Array<{ key: keyof CalculatorInputs; label: string; step?: string; help?: string }> = [
  { key: 'extraMonthlyPrincipal', label: 'Aportación mensual a capital', step: '100' },
  { key: 'extraAnnualPrincipal', label: 'Aportación anual extraordinaria', step: '1000' },
  { key: 'annualPropertyTax', label: 'Predial anual', step: '500' },
  { key: 'annualInsurance', label: 'Seguro anual', step: '500' },
  { key: 'annualExtraMaintenance', label: 'Mantenimiento anual extraordinario', step: '500' },
  { key: 'annualRepairs', label: 'Reparaciones anuales esperadas', step: '500' },
  { key: 'monthlyAdministrationCost', label: 'Costo mensual de administración / tiempo', step: '100' }
];

function exportCsv(rows: ReturnType<typeof calculateInvestment>['annualRows']): void {
  const headers = [
    'anio',
    'renta_mensual_bruta',
    'renta_mensual_efectiva',
    'flujo_mensual',
    'costo_tenencia_mensual',
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
      row.effectiveRentMonthly.toFixed(2),
      row.cashFlowMonthly.toFixed(2),
      row.ownershipCostMonthly.toFixed(2),
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
    rentaMensual: row.effectiveRentMonthly,
    patrimonioBase: row.netWorthBase,
    patrimonioConAportaciones: row.netWorthWithExtras
  }));

  const handleNumberChange = (key: keyof CalculatorInputs, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [key]: Number(value)
    }));
  };

  const scenarioNames: ScenarioName[] = ['conservador', 'base', 'optimista'];

  return (
    <section className="grid gap-6 lg:grid-cols-[440px_1fr]">
      <div className="card h-fit space-y-3">
        <h2 className="text-lg font-semibold">Entradas del análisis</h2>
        <p className="text-sm text-slate-600">Simulación para créditos hipotecarios en México. La deuda no se vuelve barata nominalmente; su carga relativa puede mejorar con mayor renta y menor deuda.</p>

        <div className="grid gap-3">
          {MAIN_FIELDS.map((field) => (
            <label key={field.key} className="text-sm">
              <span className="flex items-center gap-2 font-medium">
                {field.label}
                {field.help ? <span className="help" title={field.help}>?</span> : null}
              </span>
              <input
                className="input"
                type="number"
                step={field.step ?? '1'}
                value={inputs[field.key] as number}
                onChange={(event) => handleNumberChange(field.key, event.target.value)}
                readOnly={field.key === 'loanAmount' || field.key === 'monthlyMortgagePayment'}
              />
            </label>
          ))}

          <label className="text-sm">
            <span className="font-medium">Modo de renta inicial</span>
            <select
              className="input"
              value={inputs.rentMode}
              onChange={(event) => setInputs((prev) => ({ ...prev, rentMode: event.target.value as CalculatorInputs['rentMode'] }))}
            >
              <option value="manual">Manual</option>
              <option value="coverage">Estimado por cobertura de hipoteca</option>
              <option value="yield">Estimado por rendimiento del valor</option>
            </select>
          </label>

          {inputs.rentMode === 'manual' ? (
            <label className="text-sm">
              <span className="font-medium">Renta mensual inicial</span>
              <input className="input" type="number" step="100" value={inputs.initialRent} onChange={(event) => handleNumberChange('initialRent', event.target.value)} />
            </label>
          ) : null}

          {inputs.rentMode === 'coverage' ? (
            <label className="text-sm">
              <span className="font-medium">Cobertura inicial renta/hipoteca (%)</span>
              <input className="input" type="number" step="1" value={inputs.initialRentCoveragePercent} onChange={(event) => handleNumberChange('initialRentCoveragePercent', event.target.value)} />
            </label>
          ) : null}

          {inputs.rentMode === 'yield' ? (
            <label className="text-sm">
              <span className="font-medium">Rendimiento bruto inicial anual (% del valor)</span>
              <input className="input" type="number" step="0.1" value={inputs.initialRentYieldPercent} onChange={(event) => handleNumberChange('initialRentYieldPercent', event.target.value)} />
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="font-medium">Vacancia</span>
              <select
                className="input"
                value={inputs.vacancyMode}
                onChange={(event) => setInputs((prev) => ({ ...prev, vacancyMode: event.target.value as CalculatorInputs['vacancyMode'] }))}
              >
                <option value="months">Meses/año</option>
                <option value="percent">Porcentaje anual</option>
              </select>
            </label>
            {inputs.vacancyMode === 'months' ? (
              <label className="text-sm">
                <span className="font-medium">Meses sin renta / año</span>
                <input className="input" type="number" step="0.1" value={inputs.vacancyMonthsPerYear} onChange={(event) => handleNumberChange('vacancyMonthsPerYear', event.target.value)} />
              </label>
            ) : (
              <label className="text-sm">
                <span className="font-medium">Vacancia anual (%)</span>
                <input className="input" type="number" step="0.1" value={inputs.vacancyRatePercent} onChange={(event) => handleNumberChange('vacancyRatePercent', event.target.value)} />
              </label>
            )}
          </div>
        </div>

        <details className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer font-semibold text-slate-800">Supuestos avanzados</summary>
          <div className="mt-3 grid gap-3">
            {ADVANCED_FIELDS.map((field) => (
              <label key={field.key} className="text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {field.label}
                  {field.help ? <span className="help" title={field.help}>?</span> : null}
                </span>
                <input className="input" type="number" step={field.step ?? '1'} value={inputs[field.key] as number} onChange={(event) => handleNumberChange(field.key, event.target.value)} />
              </label>
            ))}
          </div>
        </details>

        <details className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer font-semibold text-slate-800">Escenarios (conservador · base · optimista)</summary>
          <div className="mt-3 space-y-3">
            {scenarioNames.map((name) => (
              <div key={name} className="rounded-lg border border-slate-200 p-2">
                <p className="mb-2 text-sm font-semibold capitalize">{name}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <ScenarioInput
                    label="Crecimiento renta anual (%)"
                    value={inputs.scenarios[name].annualRentGrowth}
                    onChange={(next) => setInputs((prev) => ({ ...prev, scenarios: { ...prev.scenarios, [name]: { ...prev.scenarios[name], annualRentGrowth: next } } }))}
                  />
                  <ScenarioInput
                    label="Plusvalía anual (%)"
                    value={inputs.scenarios[name].annualAppreciation}
                    onChange={(next) => setInputs((prev) => ({ ...prev, scenarios: { ...prev.scenarios, [name]: { ...prev.scenarios[name], annualAppreciation: next } } }))}
                  />
                  <ScenarioInput
                    label="Vacancia anual (%)"
                    value={inputs.scenarios[name].vacancyRatePercent}
                    onChange={(next) => setInputs((prev) => ({ ...prev, scenarios: { ...prev.scenarios, [name]: { ...prev.scenarios[name], vacancyRatePercent: next } } }))}
                  />
                  <ScenarioInput
                    label="Multiplicador costos mantto"
                    value={inputs.scenarios[name].maintenanceMultiplier}
                    step="0.05"
                    onChange={(next) => setInputs((prev) => ({ ...prev, scenarios: { ...prev.scenarios, [name]: { ...prev.scenarios[name], maintenanceMultiplier: next } } }))}
                  />
                  <ScenarioInput
                    label="Cobertura inicial renta/hipoteca (%)"
                    value={inputs.scenarios[name].initialRentCoveragePercent}
                    onChange={(next) => setInputs((prev) => ({ ...prev, scenarios: { ...prev.scenarios, [name]: { ...prev.scenarios[name], initialRentCoveragePercent: next } } }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </details>

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

        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          Esta herramienta es una simulación educativa: no garantiza resultados reales. El resultado depende de vacancia, costos y plusvalía efectiva del mercado.
        </p>

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
          <MetricCard title="Cobertura renta / hipoteca" value={`${(result.rentToMortgageCoverage * 100).toFixed(1)}%`} help="Renta efectiva inicial dividida entre pago de hipoteca." />
          <MetricCard title="Flujo neto ajustado por vacancia" value={formatCurrency(result.flowAdjustedForVacancy)} />
          <MetricCard title="Break-even de flujo" value={result.breakEvenYear ? `Año ${result.breakEvenYear}` : 'No alcanza'} />
          <MetricCard title="Costo total de tenencia" value={formatCurrency(result.totalHoldingCost)} />
          <MetricCard title="Patrimonio neto proyectado" value={formatCurrency(result.netWorthProjected)} />
          <MetricCard title="Deuda restante al horizonte" value={formatCurrency(result.remainingDebtAtHorizon)} />
          <MetricCard title="Intereses totales pagados" value={formatCurrency(result.totalInterestPaidWithExtras)} />
          <MetricCard title="Ahorro por aportaciones" value={formatCurrency(result.savingsFromExtraPayments)} />
          <MetricCard title="Rendimiento acumulado estimado" value={formatCurrency(result.estimatedAccumulatedReturn)} />
          <MetricCard title="¿Se sostiene sola?" value={result.propertySelfSustained ? 'Sí' : 'No'} help="Se considera autosostenida cuando el flujo ajustado inicial es no-negativo." />
          <MetricCard title="Flujo mensual año 5" value={formatCurrency(fifthYear.cashFlowMonthly)} />
          <MetricCard title="Flujo mensual año 10" value={formatCurrency(tenthYear.cashFlowMonthly)} />
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

          <ChartCard title="Evolución de renta mensual efectiva (ajustada por vacancia)">
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
            <div className="grid gap-3 text-sm md:grid-cols-1">
              {result.scenarioSummaries.map((scenario) => (
                <article key={scenario.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold capitalize text-slate-800">{scenario.name}</p>
                  <ul className="mt-2 space-y-1">
                    <li>Cobertura inicial: <strong>{(scenario.initialCoverageRatio * 100).toFixed(1)}%</strong></li>
                    <li>Flujo al horizonte: <strong>{formatCurrency(scenario.adjustedMonthlyCashFlowAtHorizon)}</strong></li>
                    <li>Break-even: <strong>{scenario.breakEvenYear ? `Año ${scenario.breakEvenYear}` : 'No alcanza'}</strong></li>
                    <li>Patrimonio: <strong>{formatCurrency(scenario.projectedNetWorth)}</strong></li>
                    <li>¿Se sostiene sola?: <strong>{scenario.sustainedByRent ? 'Sí' : 'No'}</strong></li>
                  </ul>
                </article>
              ))}
            </div>
            <ScenarioSummary
              title="Comparativa de amortización (compatibilidad)"
              payoff={result.withExtras.payoffMonths}
              interest={result.withExtras.totalInterestPaid}
              debt={result.withExtras.remainingDebtAtHorizon}
            />
          </div>
        </div>

        <div className="card overflow-x-auto">
          <h3 className="mb-3 text-base font-semibold">Tabla anual de proyección</h3>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2">Año</th>
                <th className="px-3 py-2">Renta mensual efectiva</th>
                <th className="px-3 py-2">Flujo mensual</th>
                <th className="px-3 py-2">Costo tenencia mensual</th>
                <th className="px-3 py-2">Deuda restante (con aportaciones)</th>
                <th className="px-3 py-2">Valor propiedad</th>
                <th className="px-3 py-2">Patrimonio neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.annualRows.map((row) => (
                <tr key={row.year}>
                  <td className="px-3 py-2">{row.year}</td>
                  <td className="px-3 py-2">{formatCurrency(row.effectiveRentMonthly)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.cashFlowMonthly)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.ownershipCostMonthly)}</td>
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

function ScenarioInput({ label, value, step = '0.1', onChange }: { label: string; value: number; step?: string; onChange: (next: number) => void }) {
  return (
    <label className="text-xs">
      <span className="font-medium">{label}</span>
      <input className="input" type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
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
      <ul className="mt-2 space-y-1 text-sm">
        <li>Liquidación estimada: <strong>{formatMonthsToYears(payoff)}</strong></li>
        <li>Intereses totales: <strong>{formatCurrency(interest)}</strong></li>
        <li>Deuda al horizonte: <strong>{formatCurrency(debt)}</strong></li>
      </ul>
    </article>
  );
}
