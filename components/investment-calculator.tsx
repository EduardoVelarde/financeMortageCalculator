'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import {
  calculateInvestment,
  deriveLoanValues,
  getDefaultInputs,
  validateInputs,
  type MortgageInputs,
  type OperatingCostMode,
  type ScenarioName,
  type AnnualProjectionRow
} from '@/lib/finance';
import { formatCurrency, formatMonthsToYears } from '@/lib/format';

const SCENARIO_OPTIONS: Array<{ value: ScenarioName; label: string }> = [
  { value: 'conservador', label: 'Conservador' },
  { value: 'base', label: 'Base' },
  { value: 'optimista', label: 'Optimista' },
  { value: 'personalizado', label: 'Personalizado' }
];

function exportCsv(rows: AnnualProjectionRow[]): void {
  const headers = [
    'anio',
    'renta_bruta_mensual',
    'vacancia',
    'renta_efectiva_mensual',
    'hipoteca_mensual',
    'mant_admin_mensual',
    'otros_gastos_mensuales',
    'flujo_neto_mensual',
    'deuda_restante',
    'valor_propiedad',
    'patrimonio_neto'
  ];

  const csvRows = rows.map((row) =>
    [
      row.year,
      row.rentGrossMonthly.toFixed(2),
      row.vacancyMonthlyImpact.toFixed(2),
      row.rentEffectiveMonthly.toFixed(2),
      row.mortgageMonthlyCost.toFixed(2),
      row.maintenanceAdminMonthlyCost.toFixed(2),
      row.otherCostsMonthly.toFixed(2),
      row.netCashFlowMonthly.toFixed(2),
      row.remainingDebtWithExtras.toFixed(2),
      row.propertyValue.toFixed(2),
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
  const [inputs, setInputs] = useState<MortgageInputs>(defaults);

  useEffect(() => {
    const derived = deriveLoanValues(inputs);
    if (inputs.loanAmount === derived.loanAmount && inputs.monthlyMortgagePayment === derived.monthlyMortgagePayment) return;
    setInputs((prev) => ({ ...prev, loanAmount: derived.loanAmount, monthlyMortgagePayment: derived.monthlyMortgagePayment }));
  }, [inputs]);

  const errors = useMemo(() => validateInputs(inputs), [inputs]);
  const result = useMemo(() => calculateInvestment(inputs), [inputs]);
  const selected = result.selectedScenario;

  const firstYear = selected.annualRows[0];
  const isPresetScenario = inputs.selectedScenario !== 'personalizado';

  const coveragePreview = {
    mortgage: inputs.monthlyMortgagePayment,
    coverage: result.selectedAssumptions.initialRentCoveragePercent,
    grossRent: firstYear.rentGrossMonthly,
    vacancy: firstYear.vacancyMonthlyImpact,
    effectiveRent: firstYear.rentEffectiveMonthly
  };

  const chartData = selected.annualRows.map((row) => ({
    year: row.year,
    deuda: row.remainingDebtWithExtras,
    rentaEfectiva: row.rentEffectiveMonthly,
    patrimonio: row.netWorthWithExtras,
    flujo: row.netCashFlowMonthly
  }));

  const updateScenarioAssumption = (field: 'annualRentGrowth' | 'annualAppreciation' | 'vacancyRatePercent' | 'initialRentCoveragePercent', value: number) => {
    setInputs((prev) => {
      const next = structuredClone(prev);
      if (next.selectedScenario !== 'personalizado') {
        next.selectedScenario = 'personalizado';
        next.customAssumptions = { ...next.scenarioPresets[prev.selectedScenario as 'conservador' | 'base' | 'optimista'] };
      }
      next.customAssumptions[field] = value;
      return next;
    });
  };

  const updateOperatingMode = (costType: 'maintenanceAdmin' | 'otherCosts', mode: OperatingCostMode) => {
    setInputs((prev) => ({
      ...prev,
      operatingCosts: {
        ...prev.operatingCosts,
        [costType]: {
          ...prev.operatingCosts[costType],
          mode
        }
      }
    }));
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[440px_1fr] print:block">
      <div className="card h-fit space-y-4 print:hidden">
        <h2 className="text-lg font-semibold">Inputs del análisis</h2>

        <InputSection title="5. Escenario de análisis">
          <label className="text-sm">
            <span className="font-medium">Escenario de análisis</span>
            <select className="input" value={inputs.selectedScenario} onChange={(event) => setInputs((prev) => ({ ...prev, selectedScenario: event.target.value as ScenarioName }))}>
              {SCENARIO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold">Supuestos aplicados ({selected.scenario.label})</p>
            <p>Vacancia: {result.selectedAssumptions.vacancyRatePercent.toFixed(1)}% · Incremento renta: {result.selectedAssumptions.annualRentGrowth.toFixed(1)}% · Plusvalía: {result.selectedAssumptions.annualAppreciation.toFixed(1)}%</p>
          </div>
        </InputSection>

        <InputSection title="1. Datos de la propiedad">
          <NumberInput label="Precio de la propiedad" value={inputs.propertyPrice} step="1000" onChange={(n) => setInputs((prev) => ({ ...prev, propertyPrice: n }))} />
          <NumberInput label="Enganche" value={inputs.downPayment} step="1000" onChange={(n) => setInputs((prev) => ({ ...prev, downPayment: n }))} />
          <NumberInput label="Monto del crédito (auto)" value={inputs.loanAmount} step="1000" readOnly onChange={() => undefined} />
        </InputSection>

        <InputSection title="2. Datos del crédito">
          <NumberInput label="Tasa anual (%)" value={inputs.annualRate} step="0.1" onChange={(n) => setInputs((prev) => ({ ...prev, annualRate: n }))} />
          <NumberInput label="Plazo del crédito (años)" value={inputs.loanTermYears} step="1" onChange={(n) => setInputs((prev) => ({ ...prev, loanTermYears: n }))} />
          <NumberInput label="Pago mensual estimado de hipoteca" value={inputs.monthlyMortgagePayment} step="100" readOnly onChange={() => undefined} />
          <NumberInput label="Horizonte de análisis (años)" value={inputs.analysisHorizonYears} step="1" onChange={(n) => setInputs((prev) => ({ ...prev, analysisHorizonYears: n }))} />
        </InputSection>

        <InputSection title="3. Supuestos de renta">
          <label className="text-sm">
            <span className="font-medium">Modo de renta inicial</span>
            <select className="input" value={inputs.rentMode} onChange={(event) => setInputs((prev) => ({ ...prev, rentMode: event.target.value as MortgageInputs['rentMode'] }))}>
              <option value="manual">Manual</option>
              <option value="coverage">Renta inicial como % de la hipoteca mensual</option>
              <option value="yield">Rendimiento anual (% valor propiedad)</option>
            </select>
          </label>

          {inputs.rentMode === 'manual' ? <NumberInput label="Renta mensual inicial" value={inputs.initialRent} step="100" onChange={(n) => setInputs((prev) => ({ ...prev, initialRent: n }))} /> : null}
          {inputs.rentMode === 'yield' ? <NumberInput label="Rendimiento bruto inicial anual (%)" value={inputs.initialRentYieldPercent} step="0.1" onChange={(n) => setInputs((prev) => ({ ...prev, initialRentYieldPercent: n }))} /> : null}

          <NumberInput
            label="Renta inicial como % de la hipoteca mensual"
            value={result.selectedAssumptions.initialRentCoveragePercent}
            step="1"
            readOnly={isPresetScenario}
            help="Ejemplo: si la hipoteca mensual es $20,000 y eliges 80%, la renta inicial estimada será $16,000 antes de vacancia y costos."
            onChange={(n) => updateScenarioAssumption('initialRentCoveragePercent', n)}
          />

          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-slate-700">
            <p>Hipoteca mensual: <strong>{formatCurrency(coveragePreview.mortgage)}</strong></p>
            <p>Cobertura elegida: <strong>{coveragePreview.coverage.toFixed(1)}%</strong></p>
            <p>Renta bruta estimada: <strong>{formatCurrency(coveragePreview.grossRent)}</strong></p>
            <p>Vacancia estimada: <strong>-{formatCurrency(coveragePreview.vacancy)}</strong></p>
            <p>Renta efectiva: <strong>{formatCurrency(coveragePreview.effectiveRent)}</strong></p>
          </div>
        </InputSection>

        <InputSection title="4. Costos operativos">
          <CostModeInput
            label="Costo mantenimiento/admin mensual"
            value={inputs.operatingCosts.maintenanceAdmin.value}
            mode={inputs.operatingCosts.maintenanceAdmin.mode}
            onModeChange={(mode) => updateOperatingMode('maintenanceAdmin', mode)}
            onValueChange={(value) => setInputs((prev) => ({ ...prev, operatingCosts: { ...prev.operatingCosts, maintenanceAdmin: { ...prev.operatingCosts.maintenanceAdmin, value } } }))}
          />
          <CostModeInput
            label="Otros gastos mensuales"
            value={inputs.operatingCosts.otherCosts.value}
            mode={inputs.operatingCosts.otherCosts.mode}
            onModeChange={(mode) => updateOperatingMode('otherCosts', mode)}
            onValueChange={(value) => setInputs((prev) => ({ ...prev, operatingCosts: { ...prev.operatingCosts, otherCosts: { ...prev.operatingCosts.otherCosts, value } } }))}
          />
          <NumberInput label="Predial anual" value={inputs.operatingCosts.annualPropertyTax} step="500" onChange={(n) => setInputs((prev) => ({ ...prev, operatingCosts: { ...prev.operatingCosts, annualPropertyTax: n } }))} />
          <NumberInput label="Seguro anual" value={inputs.operatingCosts.annualInsurance} step="500" onChange={(n) => setInputs((prev) => ({ ...prev, operatingCosts: { ...prev.operatingCosts, annualInsurance: n } }))} />
        </InputSection>

        <InputSection title="6. Supuestos avanzados">
          <NumberInput label="Incremento anual de renta (%)" value={result.selectedAssumptions.annualRentGrowth} step="0.1" readOnly={isPresetScenario} onChange={(n) => updateScenarioAssumption('annualRentGrowth', n)} />
          <NumberInput label="Plusvalía anual esperada (%)" value={result.selectedAssumptions.annualAppreciation} step="0.1" readOnly={isPresetScenario} onChange={(n) => updateScenarioAssumption('annualAppreciation', n)} />
          <NumberInput label="Vacancia anual (%)" value={result.selectedAssumptions.vacancyRatePercent} step="0.1" readOnly={isPresetScenario} onChange={(n) => updateScenarioAssumption('vacancyRatePercent', n)} />
          <NumberInput label="Aportación mensual a capital" value={inputs.extraMonthlyPrincipal} step="100" onChange={(n) => setInputs((prev) => ({ ...prev, extraMonthlyPrincipal: n }))} />
          <NumberInput label="Aportación anual extraordinaria" value={inputs.extraAnnualPrincipal} step="1000" onChange={(n) => setInputs((prev) => ({ ...prev, extraAnnualPrincipal: n }))} />
        </InputSection>

        <div className="flex flex-wrap gap-2 pt-2">
          <button className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => setInputs(getDefaultInputs())}>Cargar caso ejemplo</button>
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => setInputs(defaults)}>Resetear</button>
          <button className="rounded-lg border border-brand-700 px-3 py-2 text-sm font-semibold text-brand-700" onClick={() => exportCsv(selected.annualRows)}>Exportar CSV</button>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => window.print()}>Exportar reporte PDF</button>
        </div>

        {errors.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">Corrige los siguientes campos:</p>
            <ul className="list-inside list-disc">
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="card print:shadow-none">
          <h2 className="text-lg font-semibold">Resumen del escenario seleccionado ({selected.scenario.label})</h2>
          <p className="text-xs text-slate-500">Fecha del reporte: {new Date().toLocaleDateString('es-MX')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard title="¿Se sostiene sola?" value={selected.propertySelfSustained ? 'Sí' : 'No'} tone={selected.propertySelfSustained ? 'positive' : 'warning'} help="Flujo neto mensual año 1 mayor o igual a cero." />
            <MetricCard title="Break-even de flujo" value={selected.breakEvenYear ? `Año ${selected.breakEvenYear}` : 'No alcanza'} tone="neutral" />
            <MetricCard title="Flujo mensual año 1" value={formatCurrency(selected.initialMonthlyCashFlow)} tone={selected.initialMonthlyCashFlow >= 0 ? 'positive' : 'warning'} />
            <MetricCard title="Flujo mensual año 5" value={formatCurrency(selected.flowYear5)} tone={selected.flowYear5 >= 0 ? 'positive' : 'warning'} />
            <MetricCard title="Flujo mensual año 10" value={formatCurrency(selected.flowYear10)} tone={selected.flowYear10 >= 0 ? 'positive' : 'warning'} />
            <MetricCard title="Patrimonio neto proyectado" value={formatCurrency(selected.netWorthProjected)} tone="positive" />
            <MetricCard title="Deuda restante al horizonte" value={formatCurrency(selected.remainingDebtAtHorizon)} tone="neutral" />
          </div>
        </div>

        <details className="card print-open">
          <summary className="cursor-pointer text-sm font-semibold">Métricas avanzadas</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard title="Intereses totales pagados" value={formatCurrency(selected.totalInterestPaidWithExtras)} tone="neutral" />
            <MetricCard title="Costo total de tenencia" value={formatCurrency(selected.totalHoldingCost)} tone="warning" />
            <MetricCard title="Ahorro por aportaciones" value={formatCurrency(selected.savingsFromExtraPayments)} tone="positive" />
            <MetricCard title="Rendimiento acumulado estimado" value={formatCurrency(selected.estimatedAccumulatedReturn)} tone={selected.estimatedAccumulatedReturn >= 0 ? 'positive' : 'warning'} />
            <MetricCard title="Cobertura renta/hipoteca" value={`${(selected.rentToMortgageCoverage * 100).toFixed(1)}%`} tone={selected.rentToMortgageCoverage >= 1 ? 'positive' : 'warning'} />
            <MetricCard title="Liquidación estimada" value={formatMonthsToYears(selected.payoffMonthsWithExtras)} tone="neutral" />
          </div>
        </details>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Evolución de deuda, renta y patrimonio">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="deuda" stroke="#ef4444" name="Deuda" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rentaEfectiva" stroke="#10b981" name="Renta efectiva" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="patrimonio" stroke="#2563eb" name="Patrimonio" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="card space-y-3 print:hidden">
            <h3 className="text-base font-semibold">Comparativa compacta de escenarios</h3>
            {result.scenarioSummaries.map((scenario) => (
              <article key={scenario.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold capitalize">{scenario.name}</p>
                  <button className="rounded-md border border-brand-600 px-2 py-1 text-xs font-semibold text-brand-700" onClick={() => setInputs((prev) => ({ ...prev, selectedScenario: scenario.name }))}>Usar este escenario</button>
                </div>
                <ul className="grid gap-1 text-xs">
                  <li>Cobertura inicial: <strong>{(scenario.initialCoverageRatio * 100).toFixed(1)}%</strong></li>
                  <li>Vacancia: <strong>{scenario.vacancyRatePercent.toFixed(1)}%</strong></li>
                  <li>Incremento renta: <strong>{scenario.annualRentGrowth.toFixed(1)}%</strong></li>
                  <li>Plusvalía: <strong>{scenario.annualAppreciation.toFixed(1)}%</strong></li>
                  <li>Flujo al horizonte: <strong>{formatCurrency(scenario.adjustedMonthlyCashFlowAtHorizon)}</strong></li>
                  <li>Break-even: <strong>{scenario.breakEvenYear ? `Año ${scenario.breakEvenYear}` : 'No alcanza'}</strong></li>
                  <li>Patrimonio: <strong>{formatCurrency(scenario.projectedNetWorth)}</strong></li>
                  <li>¿Se sostiene sola?: <strong>{scenario.sustainedByRent ? 'Sí' : 'No'}</strong></li>
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="card overflow-x-auto">
          <h3 className="mb-2 text-base font-semibold">Tabla anual de proyección ({selected.scenario.label})</h3>
          <p className="mb-3 text-xs text-slate-500">La renta efectiva se calcula como renta bruta menos vacancia. El flujo neto resta hipoteca, mantenimiento/admin y otros gastos.</p>
          <table className="min-w-[1100px] divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2">Año</th>
                <th className="px-3 py-2">Renta bruta mensual</th>
                <th className="px-3 py-2">Vacancia</th>
                <th className="px-3 py-2">Renta efectiva mensual</th>
                <th className="px-3 py-2">Costo hipoteca mensual</th>
                <th className="px-3 py-2">Costo mant/admin mensual</th>
                <th className="px-3 py-2">Otros gastos mensuales</th>
                <th className="px-3 py-2">Flujo neto mensual</th>
                <th className="px-3 py-2">Deuda restante</th>
                <th className="px-3 py-2">Valor propiedad</th>
                <th className="px-3 py-2">Patrimonio neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selected.annualRows.map((row) => (
                <tr key={row.year}>
                  <td className="px-3 py-2">{row.year}</td>
                  <td className="px-3 py-2">{formatCurrency(row.rentGrossMonthly)}</td>
                  <td className="px-3 py-2 text-amber-700">-{formatCurrency(row.vacancyMonthlyImpact)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.rentEffectiveMonthly)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.mortgageMonthlyCost)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.maintenanceAdminMonthlyCost)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.otherCostsMonthly)}</td>
                  <td className={`px-3 py-2 font-semibold ${row.netCashFlowMonthly >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(row.netCashFlowMonthly)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.remainingDebtWithExtras)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.propertyValue)}</td>
                  <td className="px-3 py-2">{formatCurrency(row.netWorthWithExtras)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Esta herramienta es una simulación educativa. No garantiza resultados reales. El resultado depende de vacancia, costos, tasas, plusvalía efectiva y condiciones del mercado.
        </p>
      </div>
    </section>
  );
}

function NumberInput({ label, value, onChange, step = '1', readOnly, help }: { label: string; value: number; onChange: (value: number) => void; step?: string; readOnly?: boolean; help?: string }) {
  return (
    <label className="text-sm">
      <span className="flex items-center gap-2 font-medium">{label}{help ? <span className="help" title={help}>?</span> : null}</span>
      <input className="input" type="number" step={step} value={value} readOnly={readOnly} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function CostModeInput({ label, value, mode, onModeChange, onValueChange }: { label: string; value: number; mode: OperatingCostMode; onModeChange: (mode: OperatingCostMode) => void; onValueChange: (value: number) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select className="input mt-0" value={mode} onChange={(event) => onModeChange(event.target.value as OperatingCostMode)}>
          <option value="fixed">Monto fijo mensual</option>
          <option value="percent_rent">% de la renta</option>
          <option value="percent_property_value">% del valor propiedad</option>
        </select>
        <input className="input mt-0" type="number" step="0.1" value={value} onChange={(event) => onValueChange(Number(event.target.value))} />
      </div>
    </div>
  );
}

function InputSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function MetricCard({ title, value, tone = 'neutral', help }: { title: string; value: string; tone?: 'positive' | 'warning' | 'neutral'; help?: string }) {
  const toneClass = tone === 'positive' ? 'border-emerald-200 bg-emerald-50' : tone === 'warning' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white';
  return (
    <article className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-600">{title}{help ? <span className="help" title={help}>?</span> : null}</p>
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
