// ═══════════════════════════════════════════════════════════════════════════
// RATES CONFIG 2025 — Irish Tax Rates, Credits, Reliefs, USC & PRSI
// Source: Revenue.ie, Budget 2025, Finance Act 2024, Dept. of Social Protection
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ─── Tax Bands by Assessment Type ─────────────────────────────────────────
  // cutOff = standard rate band (20%); excess taxed at 40%
  const TAX_BANDS = {
    Single:       { cutOff: 44000, description: 'Single Person' },
    Married:      { cutOff: 53000, description: 'Married / Civil Partners (joint assessment, one income)', twoIncomeMax: 35000 },
    Widowed:      { cutOff: 44000, description: 'Widowed / Surviving Civil Partner (no dependent child)' },
    WidowedDep:   { cutOff: 44000, description: 'Widowed / Surviving Civil Partner (with dependent child)' },
    SingleParent: { cutOff: 48000, description: 'Single Person Child Carer (SPCCC holder)' },
    Separated:    { cutOff: 44000, description: 'Separated Person (non-joint)' },
  };

  // ─── Personal Tax Credits (2025) ──────────────────────────────────────────
  // Source: s.461–s.472B TCA 1997; Finance Act 2024
  const CREDITS = {
    PersonalCredit:          { amount: 2000, description: 'Personal Tax Credit (s.461)', refundable: false },
    PersonalCreditMarried:   { amount: 4000, description: 'Personal Tax Credit — Married / Civil Partners (s.461)', refundable: false },
    PersonalCreditWidowed:   { amount: 2000, description: 'Personal Tax Credit — Widowed (no dependent child)', refundable: false },
    PersonalCreditWidowedNoDep: { amount: 2540, description: 'Widowed Person or Surviving Civil Partner Credit (s.461B)', refundable: false },
    BereavementCredit:       { amount: 4000, description: 'Year of Bereavement Credit (s.461A)', refundable: false, note: 'Year of death only' },
    EmployeeCredit:          { amount: 2000, description: 'Employee (PAYE) Tax Credit (s.472)', refundable: false },
    EarnedIncomeCredit:      { amount: 2000, description: 'Earned Income Credit (s.472AB) — self-employed', refundable: false },
    SingleParentCredit:      { amount: 1900, description: 'Single Person Child Carer Credit (s.462B)', refundable: false },
    AgeCredit:               { amountSingle: 245, amountMarried: 490, description: 'Age Tax Credit — 65 and over (s.464)', refundable: false },
    HomeCarerCredit:         { amount: 1950, description: 'Home Carer Tax Credit (s.466A)', refundable: false, incomeLimit: 7200, taper: 'nil at €11,100+' },
    BlindCredit:             { amountSingle: 1950, amountBoth: 3900, description: 'Blind Person\'s Tax Credit (s.468)', refundable: false },
    GuideDogCredit:          { amount: 825, description: 'Guide Dog Allowance (s.468(4))', refundable: false },
    IncapacitatedChildCredit:{ amount: 3800, description: 'Incapacitated Child Credit (s.465)', refundable: false },
    DependentRelativeCredit: { amount: 305, description: 'Dependent Relative Credit (s.466)', refundable: false, incomeLimit: 18028 },
    WidowedParentCredit:     {
      amounts: { yr1: 3600, yr2: 3150, yr3: 2700, yr4: 2250, yr5: 1800 },
      description: 'Widowed Parent Credit (s.463) — years 1–5 after bereavement', refundable: false
    },
    RentCredit:              { amountSingle: 1000, amountMarried: 2000, description: 'Rent Tax Credit (s.473A) — tenants', refundable: true },
    MortgageInterestCredit:  { amount: 1250, description: 'Mortgage Interest Relief (once-off 2024/2025)', refundable: true, note: 'Once-off relief; 20% of increased interest; max €1,250 single / €2,500 married' },
  };

  // ─── Reliefs & Deductions (2025) ──────────────────────────────────────────
  const RELIEFS = {
    MedicalExpenses: {
      description: 'Health Expenses Relief (s.469)',
      rate: 0.20,
      cap: null,
      floor: 0,
      note: 'Relief at 20% on qualifying health expenses (net of recoveries). No monetary cap.',
    },
    Pension: {
      description: 'Pension Contributions (AVC/PRSA/RAC)',
      rate: 1.00, // full deduction from income
      ageBands: [
        { minAge: 0,  maxAge: 29, cap: 0.15 },
        { minAge: 30, maxAge: 39, cap: 0.20 },
        { minAge: 40, maxAge: 49, cap: 0.25 },
        { minAge: 50, maxAge: 54, cap: 0.30 },
        { minAge: 55, maxAge: 59, cap: 0.35 },
        { minAge: 60, maxAge: 999, cap: 0.40 },
      ],
      earningsCap: 115000,
      note: 'Age-banded cap on net relevant earnings; earnings cap €115,000',
    },
    TuitionFees: {
      description: 'Third Level Tuition Fees (s.473A)',
      rate: 0.20,
      disregard: { firstStudent: 3000, subsequentStudents: 1500 },
      perStudentCap: 7000,
      note: 'First €3,000 (or €1,500 subsequent students) disregarded; relief at 20% on qualifying fees',
    },
    Donations: {
      description: 'Charitable Donations (s.848A)',
      minAmount: 250,
      grossUpRate: 0.31,
      note: 'Minimum €250/year. Charity receives gross-up. No cap for individuals.',
    },
    RentPaid: {
      description: 'Rent Tax Credit (s.473A) — see Credits section',
      note: 'Treated as refundable credit — see CREDITS.RentCredit',
    },
    MortgageInterest: {
      description: 'Mortgage Interest Relief (once-off 2024/2025)',
      note: 'Treated as refundable credit — see CREDITS.MortgageInterestCredit',
    },
    FlatRateExpenses: {
      description: 'Flat Rate Expenses (s.114)',
      note: 'Employment-related expenses approved by Revenue; amounts vary by occupation',
    },
    CapitalAllowances: {
      description: 'Capital Allowances (s.284)',
      rate: 1.00,
      note: 'Wear & tear allowances on plant/machinery; 12.5% p.a. general rate',
    },
    TradeCharges: {
      description: 'Trade Charges / Losses (s.396)',
      note: 'Current year trade losses; unused losses carried forward',
    },
    FarmingAveraging: {
      description: 'Farming Income Averaging (s.657)',
      note: '5-year income averaging for farming; opt-in annually',
    },
    StockRelief: {
      description: 'Stock Relief (s.666)',
      rate: 0.25,
      note: '25% general stock relief; 100% for certain young/trained farmers',
    },
    WorkFromHome: {
      description: 'Work From Home Allowance (s.114B)',
      ratePerDay: 3.20,
      note: '€3.20 per qualifying remote working day (2022+)',
    },
  };

  // ─── Universal Social Charge (USC) — 2025 ─────────────────────────────────
  // Source: Finance Act 2024 / Budget 2025
  const USC = {
    standardBands: [
      { from: 0,      to: 12012,    rate: 0.005, label: '0.5%' },
      { from: 12012,  to: 27382,    rate: 0.020, label: '2%'   },
      { from: 27382,  to: 70044,    rate: 0.030, label: '3%'   },
      { from: 70044,  to: Infinity, rate: 0.080, label: '8%'   },
    ],
    reducedBands: [ // Medical card holders or age 70+
      { from: 0,      to: 12012,    rate: 0.005, label: '0.5%' },
      { from: 12012,  to: 60000,    rate: 0.020, label: '2%'   },
      { from: 60000,  to: Infinity, rate: 0.080, label: '8%'   },
    ],
    exemptThreshold: 13000,
    note: 'USC exempt if total income ≤ €13,000. Reduced rates apply to those aged 70+ or with a full medical card.',
    dspExempt: true,
    foreignExempt: true,
    depositExempt: true, // DIRT final liability
  };

  // ─── PRSI Rates — 2025 ─────────────────────────────────────────────────────
  // Source: Dept. of Social Protection; Finance Act 2024
  const PRSI = {
    classA: {
      rate: 0.042,
      description: 'Class A — Employee PRSI (4.2% from Oct 2024)',
      weeklyExempt: 352,
      weeklyCredit: { max: 12, hiThreshold: 424 },
      note: 'Deducted at source via PAYE',
    },
    classS: {
      rate: 0.04125, // 4.0% (Jan–Sep 2025) + 4.2% (Oct–Dec 2025) weighted average = 4.125% effective annual rate
      description: 'Class S — Self-Employed / Directors (4.1%)',
      minAnnual: 650,
      threshold: 5000,
      note: 'Minimum €650/year where income > €5,000',
    },
    classK: {
      rate: 0.04125,
      description: 'Class K — Unearned Income (rental, dividends etc.)',
      threshold: 5000,
      note: 'Applies to unearned income > €5,000 for PAYE employees',
    },
    classB: { rate: 0, description: 'Class B/C/D — Modified rate (public servants)', note: 'No PRSI on employment income; Class K on unearned' },
    classM: { rate: 0, description: 'Class M — No PRSI', note: 'Exempt from all PRSI' },
    age70Exempt: true,
    age70Note: 'Persons aged 70+ are exempt from PRSI',
    depositExempt: true,
    depositNote: 'Deposit interest (DIRT) is a final liability — no PRSI charged',
  };

  // ─── Form Type Rules ───────────────────────────────────────────────────────
  const FORM_TYPE_RULES = {
    Form11: {
      description: 'Form 11 — Self-Assessment (ROS)',
      triggers: [
        'Self-employed income (trade/profession)',
        'Proprietary director (controlling interest)',
        'Gross rental income > €5,000',
        'Foreign income of any amount',
        'Net non-PAYE income > €5,000 (chargeable person)',
        'PSWT / RCT credit',
        'Farming income',
        'CGT with a gain',
        'Deposit interest where DIRT certificate not obtained',
      ],
      deadline: '31 October (extended for ROS e-Filing: typically 12+ November)',
      filing: 'Revenue Online Service (ROS)',
    },
    Form12: {
      description: 'Form 12 — PAYE Return (myAccount)',
      restrictions: [
        'PAYE income only (no trading income)',
        'Gross rental income ≤ €5,000',
        'No foreign income',
        'No CGT',
        'No PSWT/RCT credits',
        'Non-PAYE income ≤ €5,000 net',
      ],
      deadline: '31 October',
      filing: 'Revenue myAccount',
    },
  };

  // ─── DIRT (Deposit Interest Retention Tax) ─────────────────────────────────
  const DIRT = {
    rate: 0.33,
    description: 'Deposit Interest Retention Tax (DIRT) — 33%',
    finalLiability: true,
    note: 'DIRT is a final liability — no further IT/USC/PRSI due on deposit interest. '
        + 'Age 65+ or permanently incapacitated may reclaim via Form 54 if income below exemption limits.',
  };

  // ─── CGT (Capital Gains Tax) ────────────────────────────────────────────────
  const CGT = {
    rate: 0.33,
    annualExemption: 1270,
    description: 'Capital Gains Tax — 33%',
    note: 'Annual personal exemption €1,270. Gains from disposal of assets.',
  };

  // ─── DWT (Dividend Withholding Tax) ────────────────────────────────────────
  const DWT = {
    rate: 0.25,
    description: 'Dividend Withholding Tax — 25%',
    note: 'DWT is an on-account credit against IT. Irish dividends are included in the IT computation.',
  };

  // ─── Income Exemption Limits (age 65+) ─────────────────────────────────────
  const EXEMPTION_LIMITS = {
    single: 18000,
    married: 36000,
    note: 'Persons aged 65+ are exempt from IT if total income is at or below the exemption limit.',
    marginalReliefNote: 'Marginal relief available if income slightly exceeds limit.',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get tax band configuration for assessment type.
   * @param {string} assessmentType - 'Single'|'Married'|'Widowed'|'WidowedDep'|'SingleParent'|'Separated'
   * @returns {object} Tax band object with cutOff and description
   */
  function getTaxBand(assessmentType) {
    const band = TAX_BANDS[assessmentType];
    if (!band) {
      throw new Error('Unknown assessmentType "' + assessmentType + '". Valid types: ' + Object.keys(TAX_BANDS).join(', '));
    }
    return Object.assign({}, band);
  }

  /**
   * Get a specific tax credit configuration.
   * @param {string} creditName - Credit name (e.g. 'PersonalCredit', 'EmployeeCredit')
   * @returns {object} Credit configuration object
   */
  function getCredit(creditName) {
    const credit = CREDITS[creditName];
    if (!credit) {
      throw new Error('Unknown credit "' + creditName + '". Valid credits: ' + Object.keys(CREDITS).join(', '));
    }
    return Object.assign({}, credit);
  }

  /**
   * Get a specific relief configuration.
   * @param {string} reliefName - Relief name (e.g. 'Pension', 'MedicalExpenses')
   * @returns {object} Relief configuration object
   */
  function getRelief(reliefName) {
    const relief = RELIEFS[reliefName];
    if (!relief) {
      throw new Error('Unknown relief "' + reliefName + '". Valid reliefs: ' + Object.keys(RELIEFS).join(', '));
    }
    return Object.assign({}, relief);
  }

  /**
   * Calculate USC on a given income.
   * @param {number} income - Assessable income for USC
   * @param {string} uscType - 'standard' | 'reduced' (70+ or medical card)
   * @returns {{ bands: Array, total: number }}
   */
  function calculateUSC(income, uscType) {
    uscType = uscType || 'standard';
    if (typeof income !== 'number' || isNaN(income) || income < 0) income = 0;

    if (income <= USC.exemptThreshold) {
      return { bands: [], total: 0, exempt: true, reason: 'Income ≤ €' + USC.exemptThreshold.toLocaleString() };
    }

    const schedule = (uscType === 'reduced') ? USC.reducedBands : USC.standardBands;
    const bands = [];
    let remaining = income;
    let prev = 0;

    for (var i = 0; i < schedule.length; i++) {
      var b = schedule[i];
      if (remaining <= 0) break;
      var width = isFinite(b.to) ? Math.min(remaining, b.to - prev) : remaining;
      if (width <= 0) { prev = b.to; continue; }
      var charge = Math.round(width * b.rate * 100) / 100;
      bands.push({ from: prev, to: isFinite(b.to) ? b.to : null, rate: b.rate, label: b.label, income: width, charge: charge });
      remaining -= width;
      prev = b.to;
    }

    var total = bands.reduce(function(s, b) { return s + b.charge; }, 0);
    total = Math.round(total * 100) / 100;
    return { bands: bands, total: total, exempt: false };
  }

  /**
   * Get PRSI rate configuration for a class.
   * @param {string} prsiClass - 'A'|'S'|'K'|'B'|'M'
   * @returns {object} PRSI rate configuration
   */
  function getPRSIRate(prsiClass) {
    var map = { A: 'classA', S: 'classS', K: 'classK', B: 'classB', M: 'classM',
                A1: 'classA', A2: 'classA' };
    var key = map[prsiClass] || ('class' + prsiClass);
    var cfg = PRSI[key];
    if (!cfg) {
      return { rate: 0, description: 'Unknown PRSI class: ' + prsiClass };
    }
    return Object.assign({}, cfg);
  }

  /**
   * Get Form Type rules.
   * @param {string} formType - 'Form11' | 'Form12'
   * @returns {object} Form type rules
   */
  function getFormTypeRules(formType) {
    var rules = FORM_TYPE_RULES[formType];
    if (!rules) {
      throw new Error('Unknown formType "' + formType + '". Valid types: Form11, Form12');
    }
    return Object.assign({}, rules);
  }

  /**
   * Auto-detect the likely form type based on income sources.
   * @param {object} incomeSources - Object describing income flags
   * @returns {{ formType: string, triggers: string[] }}
   */
  function detectFormType(incomeSources) {
    incomeSources = incomeSources || {};
    var triggers = [];

    if (incomeSources.hasTrade || incomeSources.selfEmployed) triggers.push('Self-employed income');
    if (incomeSources.isDirector) triggers.push('Proprietary director');
    if ((incomeSources.rentalGross || 0) > 5000) triggers.push('Gross rental income > €5,000');
    if (incomeSources.hasForeignIncome) triggers.push('Foreign income');
    if (incomeSources.hasCGT) triggers.push('Capital gain');
    if (incomeSources.hasPSWT || incomeSources.hasRCT) triggers.push('PSWT/RCT credit');
    if (incomeSources.hasFarming) triggers.push('Farming income');
    if ((incomeSources.nonPAYENet || 0) > 5000) triggers.push('Net non-PAYE income > €5,000');

    return {
      formType: triggers.length > 0 ? 'Form11' : 'Form12',
      triggers: triggers,
    };
  }

  /**
   * Get pension contribution cap (% of net relevant earnings) for a given age.
   * @param {number} age
   * @returns {number} Maximum contribution rate (0–1)
   */
  function getPensionCapRate(age) {
    age = age || 0;
    var bands = RELIEFS.Pension.ageBands;
    for (var i = 0; i < bands.length; i++) {
      if (age >= bands[i].minAge && age <= bands[i].maxAge) {
        return bands[i].cap;
      }
    }
    return 0.15;
  }

  /**
   * List all supported tax years in this configuration.
   * @returns {number[]}
   */
  function listSupportedYears() {
    return [2025];
  }

  /**
   * Get all raw data for a category.
   * @param {string} category - 'bands'|'credits'|'reliefs'|'usc'|'prsi'|'formRules'|'dirt'|'cgt'|'dwt'
   */
  function getAll(category) {
    var map = {
      bands: TAX_BANDS,
      credits: CREDITS,
      reliefs: RELIEFS,
      usc: USC,
      prsi: PRSI,
      formRules: FORM_TYPE_RULES,
      dirt: DIRT,
      cgt: CGT,
      dwt: DWT,
      exemptions: EXEMPTION_LIMITS,
    };
    if (!map[category]) {
      throw new Error('Unknown category "' + category + '". Valid: ' + Object.keys(map).join(', '));
    }
    return map[category];
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  var RATES_CONFIG = {
    year: 2025,
    TAX_BANDS: TAX_BANDS,
    CREDITS: CREDITS,
    RELIEFS: RELIEFS,
    USC: USC,
    PRSI: PRSI,
    FORM_TYPE_RULES: FORM_TYPE_RULES,
    DIRT: DIRT,
    CGT: CGT,
    DWT: DWT,
    EXEMPTION_LIMITS: EXEMPTION_LIMITS,
    // Helper methods
    getTaxBand: getTaxBand,
    getCredit: getCredit,
    getRelief: getRelief,
    calculateUSC: calculateUSC,
    getPRSIRate: getPRSIRate,
    getFormTypeRules: getFormTypeRules,
    detectFormType: detectFormType,
    getPensionCapRate: getPensionCapRate,
    listSupportedYears: listSupportedYears,
    getAll: getAll,
  };

  // Expose globally
  global.RATES_CONFIG = RATES_CONFIG;

})(typeof window !== 'undefined' ? window : this);
