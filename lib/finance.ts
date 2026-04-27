export type RentMode = 'manual' | 'coverage' | 'yield';
export type VacancyMode = 'months' | 'percent';
export type ScenarioName = 'conservador' | 'base' | 'optimista';

export interface ScenarioAssumptions {
  annualRentGrowth: number;
  annualAppreciation: number;
  vacancyRatePercent: number;
  maintenanceMultiplier: number;
  initialRentCoveragePercent: number;
}

export interface CalculatorInputs {
  propertyPrice: number;
  downPayment: number;
  loanAmount: number;
  annualRate: number;
  loanTermYears: number;
  monthlyMortgagePayment: number;
  initialRent: number;
  annualRentGrowth: number;
  extraMonthlyPrincipal: number;
  extraAnnualPrincipal: number;
  annualAppreciation: number;
  monthlyExpenses: number;
  analysisHorizonYears: number;
  annualPropertyTax: number;
  annualInsurance: number;
  annualExtraMaintenance: number;
  annualRepairs: number;
  monthlyAdministrationCost: number;
  vacancyMode: VacancyMode;
  vacancyMonthsPerYear: number;
  vacancyRatePercent: number;
  rentMode: RentMode;
  initialRentCoveragePercent: number;
  initialRentYieldPercent: number;
  scenarios: Record<ScenarioName, ScenarioAssumptions>;
}

export interface AnnualProjection {
  year: number;
  rentMonthly: number;
  effectiveRentMonthly: number;
  cashFlowMonthly: number;
  ownershipCostMonthly: number;
  remainingDebtBase: number;
  remainingDebtWithExtras: number;
  propertyValue: number;
  netWorthBase: number;
  netWorthWithExtras: number;
  totalCashFlowAccumulated: number;
}

export interface ScenarioSummary {
  payoffMonths: number;
  totalInterestPaid: number;
  remainingDebtAtHorizon: number;
  principalPaidAtHorizon: number;
}

export interface ScenarioKpiSummary {
  name: ScenarioName;
  initialCoverageRatio: number;
  adjustedMonthlyCashFlowAtHorizon: number;
  breakEvenYear: number | null;
  projectedNetWorth: number;
  holdingCostTotal: number;
  sustainedByRent: boolean;
}

export interface CalculationResult {
  initialMonthlyCashFlow: number;
  annualRows: AnnualProjection[];
  base: ScenarioSummary;
  withExtras: ScenarioSummary;
  netWorthProjected: number;
  totalBenefitEstimated: number;
  interestSavings: number;
  reducedTermMonths: number;
  rentToMortgageCoverage: number;
  flowAdjustedForVacancy: number;
  totalHoldingCost: number;
  breakEvenYear: number | null;
  remainingDebtAtHorizon: number;
  totalInterestPaidWithExtras: number;
  savingsFromExtraPayments: number;
  estimatedAccumulatedReturn: number;
  propertySelfSustained: boolean;
  scenarioSummaries: ScenarioKpiSummary[];
}

export interface DerivedLoanValues {
  loanAmount: number;
  monthlyMortgagePayment: number;
}

export function getDefaultInputs(): CalculatorInputs {
  return {
    propertyPrice: 2670000,
    downPayment: 534000,
    loanAmount: 2136000,
    annualRate: 9.5,
    loanTermYears: 20,
    monthlyMortgagePayment: 19895,
    initialRent: 20000,
    annualRentGrowth: 5,
    extraMonthlyPrincipal: 5000,
    extraAnnualPrincipal: 60000,
    annualAppreciation: 4,
    monthlyExpenses: 1500,
    analysisHorizonYears: 10,
    annualPropertyTax: 12000,
    annualInsurance: 6000,
    annualExtraMaintenance: 18000,
    annualRepairs: 12000,
    monthlyAdministrationCost: 1000,
    vacancyMode: 'months',
    vacancyMonthsPerYear: 1,
    vacancyRatePercent: 8.33,
    rentMode: 'manual',
    initialRentCoveragePercent: 80,
    initialRentYieldPercent: 8,
    scenarios: {
      conservador: {
        annualRentGrowth: 3,
        annualAppreciation: 2,
        vacancyRatePercent: 12,
        maintenanceMultiplier: 1.2,
        initialRentCoveragePercent: 70
      },
      base: {
        annualRentGrowth: 5,
        annualAppreciation: 4,
        vacancyRatePercent: 8,
        maintenanceMultiplier: 1,
        initialRentCoveragePercent: 80
      },
      optimista: {
        annualRentGrowth: 7,
        annualAppreciation: 6,
        vacancyRatePercent: 5,
        maintenanceMultiplier: 0.9,
        initialRentCoveragePercent: 95
      }
    }
  };
}

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
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

export function deriveLoanValues(inputs: CalculatorInputs): DerivedLoanValues {
  const loanAmount = normalizeLoanAmount(inputs.propertyPrice, inputs.downPayment);
  const monthlyMortgagePayment = Math.round(calculateConventionalMortgagePayment(loanAmount, inputs.annualRate, inputs.loanTermYears));

  return {
    loanAmount: safeNumber(loanAmount),
    monthlyMortgagePayment: safeNumber(monthlyMortgagePayment)
  };
}

function calculateInitialRent(inputs: CalculatorInputs, coverageOverride?: number): number {
  if (inputs.rentMode === 'manual') {
    return Math.max(inputs.initialRent, 0);
  }

  if (inputs.rentMode === 'yield') {
    const annualRent = inputs.propertyPrice * (Math.max(inputs.initialRentYieldPercent, 0) / 100);
    return annualRent / 12;
  }

  const coverage = (coverageOverride ?? inputs.initialRentCoveragePercent) / 100;
  return Math.max(inputs.monthlyMortgagePayment * Math.max(coverage, 0), 0);
}

function normalizeVacancyRate(inputs: CalculatorInputs, forcedPercent?: number): number {
  if (typeof forcedPercent === 'number') {
    return Math.min(Math.max(forcedPercent / 100, 0), 1);
  }

  if (inputs.vacancyMode === 'months') {
    return Math.min(Math.max(inputs.vacancyMonthsPerYear / 12, 0), 1);
  }

  return Math.min(Math.max(inputs.vacancyRatePercent / 100, 0), 1);
}

function yearlyOwnershipCosts(inputs: CalculatorInputs, maintenanceMultiplier = 1): number {
  const recurringAnnual = (inputs.monthlyExpenses + inputs.monthlyAdministrationCost) * 12;
  const annualFixed = inputs.annualPropertyTax + inputs.annualInsurance + inputs.annualExtraMaintenance + inputs.annualRepairs;
  return (recurringAnnual + annualFixed) * maintenanceMultiplier;
}

function withDerivedLoanValues(inputs: CalculatorInputs): CalculatorInputs {
  const derived = deriveLoanValues(inputs);
  return {
    ...inputs,
    loanAmount: derived.loanAmount,
    monthlyMortgagePayment: derived.monthlyMortgagePayment
  };
}

function runLoanSimulation(rawInputs: CalculatorInputs, useExtras: boolean): ScenarioSummary {
  const inputs = withDerivedLoanValues(rawInputs);
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
      if (month <= horizonMonths) {
        remainingAtHorizon = 0;
      }
      break;
    }

    const interest = debt * r;
    const principalBase = Math.max(inputs.monthlyMortgagePayment - interest, 0);

    let paymentToPrincipal = principalBase;
    if (useExtras) {
      paymentToPrincipal += inputs.extraMonthlyPrincipal;
      if (month % 12 === 0) {
        paymentToPrincipal += inputs.extraAnnualPrincipal;
      }
    }

    const principalApplied = Math.min(paymentToPrincipal, debt);
    debt = Math.max(debt - principalApplied, 0);
    interestPaid += interest;

    if (month === horizonMonths) {
      remainingAtHorizon = debt;
    }
  }

  const principalPaidAtHorizon = Math.max(inputs.loanAmount - remainingAtHorizon, 0);

  return {
    payoffMonths,
    totalInterestPaid: safeNumber(interestPaid),
    remainingDebtAtHorizon: safeNumber(remainingAtHorizon),
    principalPaidAtHorizon: safeNumber(principalPaidAtHorizon)
  };
}

interface ProjectionOptions {
  rentGrowth: number;
  appreciation: number;
  vacancyPercent?: number;
  maintenanceMultiplier?: number;
  initialRentCoveragePercent?: number;
}

function generateAnnualProjectionWithAssumptions(rawInputs: CalculatorInputs, options?: ProjectionOptions): AnnualProjection[] {
  const inputs = withDerivedLoanValues(rawInputs);
  const rows: AnnualProjection[] = [];
  const base = runLoanSimulation(inputs, false);
  const withExtras = runLoanSimulation(inputs, true);
  const r = monthlyRate(inputs.annualRate);

  const rentGrowth = options?.rentGrowth ?? inputs.annualRentGrowth;
  const appreciation = options?.appreciation ?? inputs.annualAppreciation;
  const vacancyRate = normalizeVacancyRate(inputs, options?.vacancyPercent);
  const maintenanceMultiplier = options?.maintenanceMultiplier ?? 1;

  let debtBase = inputs.loanAmount;
  let debtWithExtras = inputs.loanAmount;
  let accumulatedCashFlow = 0;

  const initialRentMonthly = calculateInitialRent(inputs, options?.initialRentCoveragePercent);

  for (let year = 1; year <= inputs.analysisHorizonYears; year += 1) {
    const rentMonthly = initialRentMonthly * Math.pow(1 + rentGrowth / 100, year - 1);
    const effectiveRentMonthly = rentMonthly * (1 - vacancyRate);
    const ownershipCostMonthly = yearlyOwnershipCosts(inputs, maintenanceMultiplier) / 12;
    let yearlyCashFlow = 0;

    for (let m = 1; m <= 12; m += 1) {
      const mortgagePaymentForMonth = debtWithExtras > 0 ? inputs.monthlyMortgagePayment : 0;
      yearlyCashFlow += effectiveRentMonthly - mortgagePaymentForMonth - ownershipCostMonthly;

      if (debtBase > 0) {
        const interestBase = debtBase * r;
        const principalBase = Math.max(inputs.monthlyMortgagePayment - interestBase, 0);
        debtBase = Math.max(debtBase - Math.min(principalBase, debtBase), 0);
      }

      if (debtWithExtras > 0) {
        const interestWith = debtWithExtras * r;
        const principalWith = Math.max(inputs.monthlyMortgagePayment - interestWith, 0) + inputs.extraMonthlyPrincipal;
        let principalToApply = principalWith;
        if (m === 12) {
          principalToApply += inputs.extraAnnualPrincipal;
        }
        debtWithExtras = Math.max(debtWithExtras - Math.min(principalToApply, debtWithExtras), 0);
      }
    }

    const propertyValue = inputs.propertyPrice * Math.pow(1 + appreciation / 100, year);
    const cashFlowMonthly = yearlyCashFlow / 12;
    accumulatedCashFlow += yearlyCashFlow;

    rows.push({
      year,
      rentMonthly,
      effectiveRentMonthly,
      cashFlowMonthly,
      ownershipCostMonthly,
      remainingDebtBase: debtBase,
      remainingDebtWithExtras: debtWithExtras,
      propertyValue,
      netWorthBase: propertyValue - debtBase,
      netWorthWithExtras: propertyValue - debtWithExtras,
      totalCashFlowAccumulated: accumulatedCashFlow
    });
  }

  if (!rows.length) {
    rows.push({
      year: 0,
      rentMonthly: initialRentMonthly,
      effectiveRentMonthly: initialRentMonthly * (1 - vacancyRate),
      cashFlowMonthly: initialRentMonthly - inputs.monthlyMortgagePayment - inputs.monthlyExpenses,
      ownershipCostMonthly: yearlyOwnershipCosts(inputs) / 12,
      remainingDebtBase: base.remainingDebtAtHorizon,
      remainingDebtWithExtras: withExtras.remainingDebtAtHorizon,
      propertyValue: inputs.propertyPrice,
      netWorthBase: inputs.propertyPrice - base.remainingDebtAtHorizon,
      netWorthWithExtras: inputs.propertyPrice - withExtras.remainingDebtAtHorizon,
      totalCashFlowAccumulated: 0
    });
  }

  return rows;
}

export function generateAnnualProjection(rawInputs: CalculatorInputs): AnnualProjection[] {
  return generateAnnualProjectionWithAssumptions(rawInputs);
}

function scenarioSummary(rawInputs: CalculatorInputs, name: ScenarioName): ScenarioKpiSummary {
  const scenario = rawInputs.scenarios[name];
  const rows = generateAnnualProjectionWithAssumptions(rawInputs, {
    rentGrowth: scenario.annualRentGrowth,
    appreciation: scenario.annualAppreciation,
    vacancyPercent: scenario.vacancyRatePercent,
    maintenanceMultiplier: scenario.maintenanceMultiplier,
    initialRentCoveragePercent: scenario.initialRentCoveragePercent
  });

  const first = rows[0];
  const last = rows[rows.length - 1];
  const breakEvenYear = rows.find((row) => row.cashFlowMonthly >= 0)?.year ?? null;

  return {
    name,
    initialCoverageRatio: first.effectiveRentMonthly / Math.max(rawInputs.monthlyMortgagePayment, 1),
    adjustedMonthlyCashFlowAtHorizon: last.cashFlowMonthly,
    breakEvenYear,
    projectedNetWorth: last.netWorthWithExtras,
    holdingCostTotal: rows.reduce((acc, row) => acc + row.ownershipCostMonthly * 12, 0),
    sustainedByRent: first.cashFlowMonthly >= 0
  };
}

export function calculateInvestment(rawInputs: CalculatorInputs): CalculationResult {
  const inputs = withDerivedLoanValues(rawInputs);
  const base = runLoanSimulation(inputs, false);
  const withExtras = runLoanSimulation(inputs, true);
  const annualRows = generateAnnualProjection(inputs);
  const horizonRow = annualRows[annualRows.length - 1];
  const firstRow = annualRows[0];

  const initialMonthlyCashFlow = firstRow.cashFlowMonthly;
  const cashFlowAccumulated = horizonRow.totalCashFlowAccumulated;
  const interestSavings = base.totalInterestPaid - withExtras.totalInterestPaid;
  const totalBenefitEstimated = cashFlowAccumulated;
  const breakEvenYear = annualRows.find((row) => row.cashFlowMonthly >= 0)?.year ?? null;
  const totalHoldingCost = annualRows.reduce((acc, row) => acc + row.ownershipCostMonthly * 12, 0);

  const scenarioNames: ScenarioName[] = ['conservador', 'base', 'optimista'];
  const scenarioSummaries: ScenarioKpiSummary[] = scenarioNames.map((name) => scenarioSummary(inputs, name));

  return {
    initialMonthlyCashFlow,
    annualRows,
    base,
    withExtras,
    netWorthProjected: horizonRow.netWorthWithExtras,
    totalBenefitEstimated,
    interestSavings,
    reducedTermMonths: Math.max(base.payoffMonths - withExtras.payoffMonths, 0),
    rentToMortgageCoverage: firstRow.effectiveRentMonthly / Math.max(inputs.monthlyMortgagePayment, 1),
    flowAdjustedForVacancy: firstRow.cashFlowMonthly,
    totalHoldingCost,
    breakEvenYear,
    remainingDebtAtHorizon: withExtras.remainingDebtAtHorizon,
    totalInterestPaidWithExtras: withExtras.totalInterestPaid,
    savingsFromExtraPayments: interestSavings,
    estimatedAccumulatedReturn: totalBenefitEstimated + horizonRow.netWorthWithExtras - inputs.downPayment,
    propertySelfSustained: firstRow.cashFlowMonthly >= 0,
    scenarioSummaries
  };
}

export function validateInputs(inputs: CalculatorInputs): string[] {
  const errors: string[] = [];

  if (inputs.propertyPrice <= 0) errors.push('El precio de la propiedad debe ser mayor a 0.');
  if (inputs.downPayment < 0) errors.push('El enganche no puede ser negativo.');
  if (inputs.downPayment >= inputs.propertyPrice) errors.push('El enganche debe ser menor al precio de la propiedad.');
  if (inputs.annualRate < 0) errors.push('La tasa anual no puede ser negativa.');
  if (inputs.loanTermYears <= 0 || inputs.loanTermYears > 40) errors.push('El plazo del crédito debe estar entre 1 y 40 años.');
  if (inputs.analysisHorizonYears <= 0 || inputs.analysisHorizonYears > 40) errors.push('El horizonte de análisis debe estar entre 1 y 40 años.');
  if (inputs.vacancyMonthsPerYear < 0 || inputs.vacancyMonthsPerYear > 12) errors.push('La vacancia en meses debe estar entre 0 y 12.');
  if (inputs.vacancyRatePercent < 0 || inputs.vacancyRatePercent > 100) errors.push('La vacancia en porcentaje debe estar entre 0% y 100%.');

  return errors;
}
