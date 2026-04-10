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
}

export interface AnnualProjection {
  year: number;
  rentMonthly: number;
  cashFlowMonthly: number;
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

export interface CalculationResult {
  initialMonthlyCashFlow: number;
  annualRows: AnnualProjection[];
  base: ScenarioSummary;
  withExtras: ScenarioSummary;
  netWorthProjected: number;
  totalBenefitEstimated: number;
  interestSavings: number;
  reducedTermMonths: number;
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
    analysisHorizonYears: 10
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

export function generateAnnualProjection(rawInputs: CalculatorInputs): AnnualProjection[] {
  const inputs = withDerivedLoanValues(rawInputs);
  const rows: AnnualProjection[] = [];
  const base = runLoanSimulation(inputs, false);
  const withExtras = runLoanSimulation(inputs, true);
  const r = monthlyRate(inputs.annualRate);

  let debtBase = inputs.loanAmount;
  let debtWithExtras = inputs.loanAmount;
  let accumulatedCashFlow = 0;

  for (let year = 1; year <= inputs.analysisHorizonYears; year += 1) {
    const rentMonthly = inputs.initialRent * Math.pow(1 + inputs.annualRentGrowth / 100, year - 1);
    let yearlyCashFlow = 0;

    for (let m = 1; m <= 12; m += 1) {
      const mortgagePaymentForMonth = debtWithExtras > 0 ? inputs.monthlyMortgagePayment : 0;
      yearlyCashFlow += rentMonthly - mortgagePaymentForMonth - inputs.monthlyExpenses;

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

    const propertyValue = inputs.propertyPrice * Math.pow(1 + inputs.annualAppreciation / 100, year);
    const cashFlowMonthly = yearlyCashFlow / 12;
    accumulatedCashFlow += yearlyCashFlow;

    rows.push({
      year,
      rentMonthly,
      cashFlowMonthly,
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
      rentMonthly: inputs.initialRent,
      cashFlowMonthly: inputs.initialRent - inputs.monthlyMortgagePayment - inputs.monthlyExpenses,
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

export function calculateInvestment(rawInputs: CalculatorInputs): CalculationResult {
  const inputs = withDerivedLoanValues(rawInputs);
  const base = runLoanSimulation(inputs, false);
  const withExtras = runLoanSimulation(inputs, true);
  const annualRows = generateAnnualProjection(inputs);
  const horizonRow = annualRows[annualRows.length - 1];

  const initialMonthlyCashFlow = inputs.initialRent - inputs.monthlyMortgagePayment - inputs.monthlyExpenses;
  const cashFlowAccumulated = horizonRow.totalCashFlowAccumulated;
  const interestSavings = base.totalInterestPaid - withExtras.totalInterestPaid;
  const totalBenefitEstimated = cashFlowAccumulated;

  return {
    initialMonthlyCashFlow,
    annualRows,
    base,
    withExtras,
    netWorthProjected: horizonRow.netWorthWithExtras,
    totalBenefitEstimated,
    interestSavings,
    reducedTermMonths: Math.max(base.payoffMonths - withExtras.payoffMonths, 0)
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

  return errors;
}
