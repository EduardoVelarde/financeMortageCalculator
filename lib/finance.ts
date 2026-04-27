export type RentMode = 'manual' | 'coverage' | 'yield';
export type ScenarioName = 'conservador' | 'base' | 'optimista' | 'personalizado';
export type OperatingCostMode = 'fixed' | 'percent_rent' | 'percent_property_value';

export interface RentalAssumptions {
  annualRentGrowth: number;
  annualAppreciation: number;
  vacancyRatePercent: number;
  initialRentCoveragePercent: number;
}

export interface OperatingCosts {
  maintenanceAdmin: {
    mode: OperatingCostMode;
    value: number;
  };
  otherCosts: {
    mode: OperatingCostMode;
    value: number;
  };
  annualPropertyTax: number;
  annualInsurance: number;
  annualExtraMaintenance: number;
  annualRepairs: number;
}

export interface ScenarioPreset {
  name: ScenarioName;
  label: string;
  assumptions: RentalAssumptions;
}

export interface MortgageInputs {
  propertyPrice: number;
  downPayment: number;
  loanAmount: number;
  annualRate: number;
  loanTermYears: number;
  monthlyMortgagePayment: number;
  rentMode: RentMode;
  initialRent: number;
  initialRentYieldPercent: number;
  analysisHorizonYears: number;
  extraMonthlyPrincipal: number;
  extraAnnualPrincipal: number;
  operatingCosts: OperatingCosts;
  selectedScenario: ScenarioName;
  customAssumptions: RentalAssumptions;
  scenarioPresets: Record<Exclude<ScenarioName, 'personalizado'>, RentalAssumptions>;
}

export interface AnnualProjectionRow {
  year: number;
  rentGrossMonthly: number;
  vacancyMonthlyImpact: number;
  rentEffectiveMonthly: number;
  mortgageMonthlyCost: number;
  maintenanceAdminMonthlyCost: number;
  otherCostsMonthly: number;
  ownershipCostMonthly: number;
  netCashFlowMonthly: number;
  remainingDebtBase: number;
  remainingDebtWithExtras: number;
  propertyValue: number;
  netWorthBase: number;
  netWorthWithExtras: number;
  totalCashFlowAccumulated: number;
}

export interface ScenarioKpiSummary {
  name: ScenarioName;
  initialCoverageRatio: number;
  vacancyRatePercent: number;
  annualRentGrowth: number;
  annualAppreciation: number;
  adjustedMonthlyCashFlowAtHorizon: number;
  breakEvenYear: number | null;
  projectedNetWorth: number;
  sustainedByRent: boolean;
}

export interface ScenarioResult {
  scenario: ScenarioPreset;
  annualRows: AnnualProjectionRow[];
  initialMonthlyCashFlow: number;
  flowYear5: number;
  flowYear10: number;
  breakEvenYear: number | null;
  rentToMortgageCoverage: number;
  propertySelfSustained: boolean;
  netWorthProjected: number;
  remainingDebtAtHorizon: number;
  totalHoldingCost: number;
  totalInterestPaidWithExtras: number;
  savingsFromExtraPayments: number;
  estimatedAccumulatedReturn: number;
  payoffMonthsWithExtras: number;
}

export interface CalculationResult {
  selectedScenario: ScenarioResult;
  scenarioSummaries: ScenarioKpiSummary[];
  selectedAssumptions: RentalAssumptions;
  amortization: {
    withExtras: ScenarioSummary;
    base: ScenarioSummary;
  };
}

export interface ScenarioSummary {
  payoffMonths: number;
  totalInterestPaid: number;
  remainingDebtAtHorizon: number;
}

export interface DerivedLoanValues {
  loanAmount: number;
  monthlyMortgagePayment: number;
}

export function getDefaultInputs(): MortgageInputs {
  return {
    propertyPrice: 2670000,
    downPayment: 534000,
    loanAmount: 2136000,
    annualRate: 9.5,
    loanTermYears: 20,
    monthlyMortgagePayment: 19895,
    rentMode: 'coverage',
    initialRent: 20000,
    initialRentYieldPercent: 8,
    analysisHorizonYears: 10,
    extraMonthlyPrincipal: 5000,
    extraAnnualPrincipal: 60000,
    operatingCosts: {
      maintenanceAdmin: {
        mode: 'fixed',
        value: 1000
      },
      otherCosts: {
        mode: 'fixed',
        value: 1500
      },
      annualPropertyTax: 12000,
      annualInsurance: 6000,
      annualExtraMaintenance: 18000,
      annualRepairs: 12000
    },
    selectedScenario: 'base',
    customAssumptions: {
      annualRentGrowth: 5,
      annualAppreciation: 4,
      vacancyRatePercent: 8,
      initialRentCoveragePercent: 80
    },
    scenarioPresets: {
      conservador: {
        annualRentGrowth: 3,
        annualAppreciation: 2,
        vacancyRatePercent: 12,
        initialRentCoveragePercent: 70
      },
      base: {
        annualRentGrowth: 5,
        annualAppreciation: 4,
        vacancyRatePercent: 8,
        initialRentCoveragePercent: 80
      },
      optimista: {
        annualRentGrowth: 7,
        annualAppreciation: 6,
        vacancyRatePercent: 5,
        initialRentCoveragePercent: 95
      }
    }
  };
}

function monthlyRate(annualRate: number): number {
  return annualRate / 100 / 12;
}

function normalizeLoanAmount(propertyPrice: number, downPayment: number): number {
  return Math.max(propertyPrice - downPayment, 0);
}

function calculateConventionalMortgagePayment(loanAmount: number, annualRate: number, loanTermYears: number): number {
  if (loanAmount <= 0 || loanTermYears <= 0) return 0;

  const months = loanTermYears * 12;
  const r = monthlyRate(annualRate);

  if (r === 0) {
    return loanAmount / months;
  }

  const growthFactor = Math.pow(1 + r, months);
  return (loanAmount * r * growthFactor) / (growthFactor - 1);
}

export function deriveLoanValues(inputs: MortgageInputs): DerivedLoanValues {
  const loanAmount = normalizeLoanAmount(inputs.propertyPrice, inputs.downPayment);
  const monthlyMortgagePayment = Math.round(calculateConventionalMortgagePayment(loanAmount, inputs.annualRate, inputs.loanTermYears));

  return {
    loanAmount,
    monthlyMortgagePayment
  };
}

function resolveAssumptions(inputs: MortgageInputs, scenarioName?: ScenarioName): ScenarioPreset {
  const selected = scenarioName ?? inputs.selectedScenario;

  if (selected === 'personalizado') {
    return {
      name: 'personalizado',
      label: 'Personalizado',
      assumptions: { ...inputs.customAssumptions }
    };
  }

  const labels: Record<Exclude<ScenarioName, 'personalizado'>, string> = {
    conservador: 'Conservador',
    base: 'Base',
    optimista: 'Optimista'
  };

  return {
    name: selected,
    label: labels[selected],
    assumptions: { ...inputs.scenarioPresets[selected] }
  };
}

function calculateInitialRent(inputs: MortgageInputs, assumptions: RentalAssumptions): number {
  if (inputs.rentMode === 'manual') return Math.max(inputs.initialRent, 0);

  if (inputs.rentMode === 'yield') {
    const annualRent = inputs.propertyPrice * (Math.max(inputs.initialRentYieldPercent, 0) / 100);
    return annualRent / 12;
  }

  return inputs.monthlyMortgagePayment * Math.max(assumptions.initialRentCoveragePercent, 0) / 100;
}

function resolveMonthlyCost(mode: OperatingCostMode, value: number, rentGrossMonthly: number, propertyValue: number): number {
  const safeValue = Math.max(value, 0);
  if (mode === 'fixed') return safeValue;
  if (mode === 'percent_rent') return rentGrossMonthly * safeValue / 100;
  return (propertyValue * safeValue / 100) / 12;
}

function annualFixedCosts(costs: OperatingCosts): number {
  return costs.annualPropertyTax + costs.annualInsurance + costs.annualExtraMaintenance + costs.annualRepairs;
}

function runLoanSimulation(inputs: MortgageInputs, useExtras: boolean): ScenarioSummary {
  const r = monthlyRate(inputs.annualRate);
  const loanTermMonths = inputs.loanTermYears * 12;
  const horizonMonths = inputs.analysisHorizonYears * 12;

  let debt = inputs.loanAmount;
  let interestPaid = 0;
  let payoffMonths = loanTermMonths;
  let remainingAtHorizon = debt;

  for (let month = 1; month <= loanTermMonths * 3; month += 1) {
    if (debt <= 0.000001) {
      payoffMonths = month - 1;
      debt = 0;
      if (month <= horizonMonths) remainingAtHorizon = 0;
      break;
    }

    const interest = debt * r;
    let principal = Math.max(inputs.monthlyMortgagePayment - interest, 0);

    if (useExtras) {
      principal += inputs.extraMonthlyPrincipal;
      if (month % 12 === 0) principal += inputs.extraAnnualPrincipal;
    }

    const principalApplied = Math.min(principal, debt);
    debt = Math.max(debt - principalApplied, 0);
    interestPaid += interest;

    if (month === horizonMonths) remainingAtHorizon = debt;
  }

  return {
    payoffMonths,
    totalInterestPaid: interestPaid,
    remainingDebtAtHorizon: remainingAtHorizon
  };
}

export function calculateMortgageInvestmentScenario(inputs: MortgageInputs, scenarioName?: ScenarioName): ScenarioResult {
  const scenario = resolveAssumptions(inputs, scenarioName);
  const assumptions = scenario.assumptions;
  const r = monthlyRate(inputs.annualRate);

  const base = runLoanSimulation(inputs, false);
  const withExtras = runLoanSimulation(inputs, true);

  const rows: AnnualProjectionRow[] = [];
  let debtBase = inputs.loanAmount;
  let debtWithExtras = inputs.loanAmount;
  let accumulatedCashFlow = 0;

  const initialRentGross = calculateInitialRent(inputs, assumptions);

  for (let year = 1; year <= inputs.analysisHorizonYears; year += 1) {
    const propertyValue = inputs.propertyPrice * Math.pow(1 + assumptions.annualAppreciation / 100, year);
    const rentGrossMonthly = initialRentGross * Math.pow(1 + assumptions.annualRentGrowth / 100, year - 1);
    const vacancyMonthlyImpact = rentGrossMonthly * (Math.max(assumptions.vacancyRatePercent, 0) / 100);
    const rentEffectiveMonthly = rentGrossMonthly - vacancyMonthlyImpact;

    const maintenanceAdminMonthlyCost = resolveMonthlyCost(
      inputs.operatingCosts.maintenanceAdmin.mode,
      inputs.operatingCosts.maintenanceAdmin.value,
      rentGrossMonthly,
      propertyValue
    );

    const otherCostsMonthly =
      resolveMonthlyCost(inputs.operatingCosts.otherCosts.mode, inputs.operatingCosts.otherCosts.value, rentGrossMonthly, propertyValue) + annualFixedCosts(inputs.operatingCosts) / 12;

    const mortgageMonthlyCost = debtWithExtras > 0 ? inputs.monthlyMortgagePayment : 0;
    const ownershipCostMonthly = maintenanceAdminMonthlyCost + otherCostsMonthly;

    let yearCashFlow = 0;

    for (let month = 1; month <= 12; month += 1) {
      yearCashFlow += rentEffectiveMonthly - mortgageMonthlyCost - maintenanceAdminMonthlyCost - otherCostsMonthly;

      if (debtBase > 0) {
        const interestBase = debtBase * r;
        const principalBase = Math.max(inputs.monthlyMortgagePayment - interestBase, 0);
        debtBase = Math.max(debtBase - Math.min(principalBase, debtBase), 0);
      }

      if (debtWithExtras > 0) {
        const interestWith = debtWithExtras * r;
        let principalWith = Math.max(inputs.monthlyMortgagePayment - interestWith, 0) + inputs.extraMonthlyPrincipal;
        if (month === 12) principalWith += inputs.extraAnnualPrincipal;
        debtWithExtras = Math.max(debtWithExtras - Math.min(principalWith, debtWithExtras), 0);
      }
    }

    const netCashFlowMonthly = yearCashFlow / 12;
    accumulatedCashFlow += yearCashFlow;

    rows.push({
      year,
      rentGrossMonthly,
      vacancyMonthlyImpact,
      rentEffectiveMonthly,
      mortgageMonthlyCost,
      maintenanceAdminMonthlyCost,
      otherCostsMonthly,
      ownershipCostMonthly,
      netCashFlowMonthly,
      remainingDebtBase: debtBase,
      remainingDebtWithExtras: debtWithExtras,
      propertyValue,
      netWorthBase: propertyValue - debtBase,
      netWorthWithExtras: propertyValue - debtWithExtras,
      totalCashFlowAccumulated: accumulatedCashFlow
    });
  }

  const first = rows[0];
  const horizon = rows[rows.length - 1];

  const flowYear5 = rows.find((row) => row.year === 5)?.netCashFlowMonthly ?? horizon.netCashFlowMonthly;
  const flowYear10 = rows.find((row) => row.year === 10)?.netCashFlowMonthly ?? horizon.netCashFlowMonthly;

  return {
    scenario,
    annualRows: rows,
    initialMonthlyCashFlow: first.netCashFlowMonthly,
    flowYear5,
    flowYear10,
    breakEvenYear: rows.find((row) => row.netCashFlowMonthly >= 0)?.year ?? null,
    rentToMortgageCoverage: first.rentEffectiveMonthly / Math.max(inputs.monthlyMortgagePayment, 1),
    propertySelfSustained: first.netCashFlowMonthly >= 0,
    netWorthProjected: horizon.netWorthWithExtras,
    remainingDebtAtHorizon: horizon.remainingDebtWithExtras,
    totalHoldingCost: rows.reduce((acc, row) => acc + row.ownershipCostMonthly * 12, 0),
    totalInterestPaidWithExtras: withExtras.totalInterestPaid,
    savingsFromExtraPayments: base.totalInterestPaid - withExtras.totalInterestPaid,
    estimatedAccumulatedReturn: horizon.totalCashFlowAccumulated + horizon.netWorthWithExtras - inputs.downPayment,
    payoffMonthsWithExtras: withExtras.payoffMonths
  };
}

export function calculateInvestment(rawInputs: MortgageInputs): CalculationResult {
  const derived = deriveLoanValues(rawInputs);
  const inputs: MortgageInputs = {
    ...rawInputs,
    loanAmount: derived.loanAmount,
    monthlyMortgagePayment: derived.monthlyMortgagePayment
  };

  const selectedScenario = calculateMortgageInvestmentScenario(inputs, inputs.selectedScenario);

  const scenarioSummaries: ScenarioKpiSummary[] = (['conservador', 'base', 'optimista'] as const).map((scenarioName) => {
    const result = calculateMortgageInvestmentScenario(inputs, scenarioName);
    const assumptions = inputs.scenarioPresets[scenarioName];

    return {
      name: scenarioName,
      initialCoverageRatio: result.rentToMortgageCoverage,
      vacancyRatePercent: assumptions.vacancyRatePercent,
      annualRentGrowth: assumptions.annualRentGrowth,
      annualAppreciation: assumptions.annualAppreciation,
      adjustedMonthlyCashFlowAtHorizon: result.annualRows[result.annualRows.length - 1].netCashFlowMonthly,
      breakEvenYear: result.breakEvenYear,
      projectedNetWorth: result.netWorthProjected,
      sustainedByRent: result.propertySelfSustained
    };
  });

  return {
    selectedScenario,
    scenarioSummaries,
    selectedAssumptions: selectedScenario.scenario.assumptions,
    amortization: {
      base: runLoanSimulation(inputs, false),
      withExtras: runLoanSimulation(inputs, true)
    }
  };
}

export function validateInputs(inputs: MortgageInputs): string[] {
  const errors: string[] = [];

  if (inputs.propertyPrice <= 0) errors.push('El precio de la propiedad debe ser mayor a 0.');
  if (inputs.downPayment < 0) errors.push('El enganche no puede ser negativo.');
  if (inputs.downPayment > inputs.propertyPrice) errors.push('El enganche no puede ser mayor al precio de la propiedad.');
  if (inputs.loanTermYears <= 0 || inputs.loanTermYears > 40) errors.push('El plazo del crédito debe ser mayor a 0 y menor o igual a 40 años.');
  if (inputs.annualRate < 0) errors.push('La tasa anual debe ser mayor o igual a 0.');
  if (inputs.analysisHorizonYears <= 0 || inputs.analysisHorizonYears > 40) errors.push('El horizonte de análisis debe estar entre 1 y 40 años.');

  const assumption = inputs.selectedScenario === 'personalizado' ? inputs.customAssumptions : inputs.scenarioPresets[inputs.selectedScenario];

  if (assumption.vacancyRatePercent < 0 || assumption.vacancyRatePercent > 100) errors.push('La vacancia debe estar entre 0% y 100%.');
  if (assumption.initialRentCoveragePercent <= 0 && inputs.rentMode === 'coverage') errors.push('La cobertura inicial debe ser mayor a 0.');
  if (inputs.initialRent <= 0 && inputs.rentMode === 'manual') errors.push('La renta inicial manual debe ser mayor a 0.');

  return errors;
}
