// ═══════════════════════════════════════════════════════════════════════════
// COMPUTATION ENGINE 2025 — Irish Income Tax Computation
// Depends on: rates-config-2025.js (RATES_CONFIG must be loaded first)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ─── Utility ──────────────────────────────────────────────────────────────
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : Math.max(0, n); }
  function round2(v) { return Math.round(v * 100) / 100; }

  // ─── Resolve RATES_CONFIG ─────────────────────────────────────────────────
  // Supports use alongside the existing monolithic index.html RATES table or standalone
  function getRates() {
    if (global.RATES_CONFIG) return global.RATES_CONFIG;
    throw new Error('COMPUTATION_ENGINE: RATES_CONFIG not found. Load js/rates-config-2025.js first.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN PIPELINE — calculate(situation)
  //
  // situation = {
  //   assessmentType : 'Single'|'Married'|'Widowed'|'WidowedDep'|'SingleParent'|'Separated'
  //   grossIncome : {
  //     employment  : number   // Employment + occupational pension
  //     dsp         : number   // State pension / DSP (USC exempt)
  //     trade       : number   // Net trade/profession profit
  //     directors   : number   // Director's fees
  //     rental      : number   // Net rental income
  //     foreignIncome: number  // Foreign income (USC exempt)
  //     dividends   : number   // Irish dividends (IT liable; DWT is credit)
  //     deposit     : number   // Deposit interest (DIRT is final liability)
  //     other       : number   // Other taxable income
  //     bik         : number   // Benefit-in-kind
  //     cgt         : number   // Capital gain (computed separately)
  //   }
  //   reliefs : {
  //     pension          : number   // Pension contributions (pre-relief)
  //     medicalExpenses  : number   // Gross medical/health expenses
  //     medicalRecovery  : number   // Amounts recovered (insurance etc.)
  //     capitalAllowances: number
  //     rentalExpenses   : number
  //     flatRateExpenses : number
  //     wfhExpenses      : number
  //     tradeLosses      : number
  //     tuitionFees      : number   // Gross tuition fees paid
  //     tuitionStudents  : number   // Number of qualifying students (default 1)
  //     otherDeductions  : number
  //   }
  //   credits : {
  //     PersonalCredit          : number   // override; default auto-applied from assessmentType
  //     EmployeeCredit          : number
  //     EarnedIncomeCredit      : number
  //     AgeCredit               : number
  //     HomeCarerCredit         : number
  //     SingleParentCredit      : number
  //     IncapacitatedChildCredit: number
  //     DependentRelativeCredit : number
  //     BlindCredit             : number
  //     GuideDogCredit          : number
  //     RentCredit              : number
  //     MortgageInterestCredit  : number
  //     WidowedParentCredit     : number
  //     DWTCredit               : number   // auto from dividends if not provided
  //     DIRTCredit              : number   // auto from deposit if not provided
  //     PSWTCredit              : number
  //     custom                  : Array<{name:string,amount:number,refundable:boolean}>
  //   }
  //   personalDetails : {
  //     age      : number
  //     medCard  : boolean
  //     prsiClass: 'A1'|'A2'|'S'|'B'|'C'|'D'|'M'  (default 'A1')
  //   }
  //   taxPaid : {
  //     incomeTax : number
  //     usc       : number
  //     prsi      : number
  //   }
  //   taxYear : number   // default 2025
  // }
  // ═══════════════════════════════════════════════════════════════════════════

  function calculate(situation) {
    if (!situation) throw new Error('calculate() requires a situation object');

    var R = getRates();
    var taxYear = situation.taxYear || 2025;

    // ── 1. Normalise inputs ────────────────────────────────────────────────
    var assessmentType = situation.assessmentType || 'Single';
    var income  = situation.grossIncome   || {};
    var rel     = situation.reliefs       || {};
    var crd     = situation.credits       || {};
    var person  = situation.personalDetails || {};
    var paid    = situation.taxPaid       || {};

    var age      = num(person.age) || 40;
    var medCard  = !!person.medCard;
    var prsiCls  = person.prsiClass || 'A1';

    // ── 2. Aggregate income ────────────────────────────────────────────────
    var emp       = num(income.employment);
    var dsp       = num(income.dsp);
    var trade     = num(income.trade);
    var directors = num(income.directors);
    var rental    = num(income.rental);
    var foreign   = num(income.foreignIncome);
    var dividends = num(income.dividends);
    var deposit   = num(income.deposit);
    var other     = num(income.other);
    var bik       = num(income.bik);
    var cgtGain   = num(income.cgt);

    // DIRT — final liability, calculated separately
    var dirtCharge    = deposit > 0 ? round2(deposit * R.DIRT.rate) : 0;
    var dirtCreditIn  = num(crd.DIRTCredit);
    // If DIRT credit not supplied, assume fully deducted at source
    var dirtAlreadyPaid = dirtCreditIn > 0 ? dirtCreditIn : dirtCharge;

    // DWT credit
    var dwtCreditIn = num(crd.DWTCredit);
    var dwtDefault  = dividends > 0 ? round2(dividends * R.DWT.rate) : 0;
    var dwtCredit   = dwtCreditIn > 0 ? dwtCreditIn : dwtDefault;

    // Gross income for IT: deposit excluded (DIRT final); everything else included
    var grossIncome = emp + dsp + trade + directors + rental + foreign + dividends + other + bik;

    // CGT — computed separately at 33% less annual exemption
    var cgtLiability = 0;
    if (cgtGain > 0) {
      var cgtTaxable = Math.max(0, cgtGain - R.CGT.annualExemption);
      cgtLiability = round2(cgtTaxable * R.CGT.rate);
    }

    // ── 3. Reliefs ─────────────────────────────────────────────────────────
    var pension     = num(rel.pension);
    var capAllow    = num(rel.capitalAllowances);
    var rentExp     = num(rel.rentalExpenses);
    var flatRate    = num(rel.flatRateExpenses);
    var wfh         = num(rel.wfhExpenses);
    var losses      = num(rel.tradeLosses);
    var otherDed    = num(rel.otherDeductions);

    // Pension cap validation
    var netRelevantEarnings = emp + trade + directors + bik;
    var pensionEarningsCap  = R.RELIEFS.Pension.earningsCap;
    var pensionCapRate       = R.getPensionCapRate(age);
    var pensionMax           = Math.min(netRelevantEarnings, pensionEarningsCap) * pensionCapRate;
    var pensionAllowed       = Math.min(pension, pensionMax > 0 ? pensionMax : pension);
    var pensionExcess        = Math.max(0, pension - pensionAllowed);

    // Medical expenses: net relief at 20%
    var medGross    = num(rel.medicalExpenses);
    var medRecovery = num(rel.medicalRecovery);
    var medNet      = Math.max(0, medGross - medRecovery);
    var medRelief   = round2(medNet * R.RELIEFS.MedicalExpenses.rate); // relief value, not deduction from income

    // Tuition fees: s.473A disregard
    var tuitionGross    = num(rel.tuitionFees);
    var tuitionStudents = Math.max(1, Math.round(num(rel.tuitionStudents)));
    var tuitionDisregard = R.RELIEFS.TuitionFees.disregard.firstStudent
      + Math.max(0, tuitionStudents - 1) * R.RELIEFS.TuitionFees.disregard.subsequentStudents;
    var tuitionNet      = Math.max(0, tuitionGross - tuitionDisregard);
    var tuitionRelief   = round2(tuitionNet * R.RELIEFS.TuitionFees.rate);

    // Pre-IT deductions (reduce taxable income)
    var totalPreDeductions = pensionAllowed + capAllow + rentExp + flatRate + wfh + losses + otherDed;
    var taxableIncome = Math.max(0, grossIncome - totalPreDeductions);

    // ── 4. Income Tax (IT) ─────────────────────────────────────────────────
    var bandCfg  = R.getTaxBand(assessmentType);
    var cutOff   = bandCfg.cutOff;

    var itStd    = round2(Math.min(taxableIncome, cutOff) * 0.20);
    var itHigh   = round2(Math.max(0, taxableIncome - cutOff) * 0.40);
    var grossIT  = round2(itStd + itHigh);

    // ── 5. Credits ─────────────────────────────────────────────────────────
    var credits = _buildCreditList(R, assessmentType, crd, medRelief, tuitionRelief, dwtCredit, emp, trade + directors, age);

    var creditResult = _applyCreditCaps(grossIT, emp, trade + directors, credits);

    // ── 6. Net IT ──────────────────────────────────────────────────────────
    var netIT = creditResult.netIT;  // after NR credits (floor 0)
    var totalRef = creditResult.totalRefundable;
    var netITAfterRef = round2(netIT - totalRef); // can go negative (refund)

    // ── 7. USC ─────────────────────────────────────────────────────────────
    // USC base: employment + trade + directors + rental + other + bik (excl. DSP, foreign, deposit)
    var uscBase   = Math.max(0, emp + trade + directors + rental + other + bik - pensionAllowed - flatRate);
    var uscType   = (medCard || age >= 70) ? 'reduced' : 'standard';
    var uscResult = R.calculateUSC(uscBase, uscType);

    // ── 8. PRSI ────────────────────────────────────────────────────────────
    var prsiResult = _calcPRSI(R, {
      emp: emp + bik,
      se: trade,
      dirs: directors,
      rental: rental,
      dividends: dividends,
      foreign: foreign,
      other: other,
      prsiCls: prsiCls,
      age: age,
    });

    // ── 9. Net liability ───────────────────────────────────────────────────
    var totalTax   = round2(grossIT + cgtLiability);
    var totalCreds = round2(creditResult.totalNRApplied + totalRef + dwtCredit + medRelief + tuitionRelief);
    var totalUSC   = round2(uscResult.total);
    var totalPRSI  = round2(prsiResult.total);
    var dirtTotal  = dirtCharge;

    var itPaid   = num(paid.incomeTax);
    var uscPaid  = num(paid.usc);
    var prsiPaid = num(paid.prsi);

    var netITPayable   = round2(netITAfterRef - itPaid);
    var netUSCPayable  = round2(totalUSC - uscPaid);
    var netPRSIPayable = round2(totalPRSI - prsiPaid);

    // CGT balance (no paid deduction unless supplied)
    var cgtPaid = num(paid.cgt);
    var netCGT  = round2(cgtLiability - cgtPaid);

    // Overall balance (negative = refund)
    var overallBalance = round2(netITPayable + netUSCPayable + netPRSIPayable + netCGT);

    // ── 10. Return full result object ──────────────────────────────────────
    return {
      taxYear: taxYear,
      assessmentType: assessmentType,

      income: {
        employment: emp,
        dsp: dsp,
        trade: trade,
        directors: directors,
        rental: rental,
        foreignIncome: foreign,
        dividends: dividends,
        deposit: deposit,
        other: other,
        bik: bik,
        grossIncome: grossIncome,
      },

      reliefs: {
        pensionClaimed: pension,
        pensionAllowed: pensionAllowed,
        pensionExcess: pensionExcess,
        pensionMax: pensionMax,
        capitalAllowances: capAllow,
        rentalExpenses: rentExp,
        flatRateExpenses: flatRate,
        wfhExpenses: wfh,
        tradeLosses: losses,
        otherDeductions: otherDed,
        totalPreDeductions: totalPreDeductions,
        medGross: medGross,
        medRecovery: medRecovery,
        medNet: medNet,
        medRelief: medRelief,
        tuitionGross: tuitionGross,
        tuitionDisregard: tuitionDisregard,
        tuitionNet: tuitionNet,
        tuitionRelief: tuitionRelief,
      },

      taxableIncome: taxableIncome,

      incomeTax: {
        cutOff: cutOff,
        bandCfg: bandCfg,
        standardRateBand: Math.min(taxableIncome, cutOff),
        standardRateTax: itStd,
        higherRateBand: Math.max(0, taxableIncome - cutOff),
        higherRateTax: itHigh,
        grossIT: grossIT,
      },

      credits: creditResult,
      netIT: netIT,
      totalRefundableCredits: totalRef,
      netITAfterRefundable: netITAfterRef,

      usc: {
        base: uscBase,
        type: uscType,
        bands: uscResult.bands,
        total: totalUSC,
        exempt: uscResult.exempt || false,
        reason: uscResult.reason || null,
      },

      prsi: prsiResult,

      cgt: {
        gain: cgtGain,
        annualExemption: R.CGT.annualExemption,
        taxableGain: Math.max(0, cgtGain - R.CGT.annualExemption),
        liability: cgtLiability,
      },

      dirt: {
        income: deposit,
        rate: R.DIRT.rate,
        charge: dirtCharge,
        alreadyPaid: dirtAlreadyPaid,
      },

      dwt: {
        dividends: dividends,
        rate: R.DWT.rate,
        credit: dwtCredit,
      },

      summary: {
        grossIT: grossIT,
        lessNRCredits: creditResult.totalNRApplied,
        netIT: netIT,
        lessRefCredits: totalRef,
        netITAfterRefundable: netITAfterRef,
        totalUSC: totalUSC,
        totalPRSI: totalPRSI,
        cgtLiability: cgtLiability,
        dirtCharge: dirtCharge,

        taxPaid: { incomeTax: itPaid, usc: uscPaid, prsi: prsiPaid, cgt: cgtPaid },

        netITPayable: netITPayable,
        netUSCPayable: netUSCPayable,
        netPRSIPayable: netPRSIPayable,
        netCGT: netCGT,
        overallBalance: overallBalance,
        isRefund: overallBalance < 0,
      },

      personalDetails: { age: age, medCard: medCard, prsiClass: prsiCls },

      warnings: _buildWarnings({
        pensionExcess: pensionExcess,
        unusedNR: creditResult.unusedNR,
        uscExempt: uscResult.exempt || false,
        age: age,
      }),
    };
  }

  // ─── Build credit list from inputs ────────────────────────────────────────
  function _buildCreditList(R, assessmentType, crd, medRelief, tuitionRelief, dwtCredit, empIncome, earnedIncome, age) {
    var list = [];

    function addCredit(id, amount, refundable, label) {
      if (amount > 0) list.push({ id: id, amount: round2(amount), refundable: !!refundable, label: label || id });
    }

    // Personal credit — auto-determine from assessment type if not overridden
    if (crd.PersonalCredit != null) {
      addCredit('PersonalCredit', num(crd.PersonalCredit), false, 'Personal Tax Credit');
    } else {
      var isMarried = assessmentType === 'Married';
      var personal  = isMarried
        ? R.CREDITS.PersonalCreditMarried.amount
        : R.CREDITS.PersonalCredit.amount;
      addCredit('PersonalCredit', personal, false, 'Personal Tax Credit');
    }

    // Employee / PAYE credit
    if (crd.EmployeeCredit != null) {
      addCredit('EmployeeCredit', num(crd.EmployeeCredit), false, 'Employee (PAYE) Tax Credit');
    } else if (empIncome > 0) {
      addCredit('EmployeeCredit', R.CREDITS.EmployeeCredit.amount, false, 'Employee (PAYE) Tax Credit');
    }

    // Earned Income Credit
    if (num(crd.EarnedIncomeCredit) > 0) {
      addCredit('EarnedIncomeCredit', num(crd.EarnedIncomeCredit), false, 'Earned Income Credit');
    } else if (earnedIncome > 0 && !(num(crd.EmployeeCredit) > 0 || empIncome > 0)) {
      addCredit('EarnedIncomeCredit', R.CREDITS.EarnedIncomeCredit.amount, false, 'Earned Income Credit');
    }

    // Age credit
    if (age >= 65) {
      var ageCreditAmt = num(crd.AgeCredit) || (assessmentType === 'Married'
        ? R.CREDITS.AgeCredit.amountMarried
        : R.CREDITS.AgeCredit.amountSingle);
      addCredit('AgeCredit', ageCreditAmt, false, 'Age Tax Credit');
    } else if (num(crd.AgeCredit) > 0) {
      addCredit('AgeCredit', num(crd.AgeCredit), false, 'Age Tax Credit');
    }

    // Other NR credits
    var nrMap = [
      ['HomeCarerCredit',          'Home Carer Tax Credit'],
      ['SingleParentCredit',       'Single Person Child Carer Credit'],
      ['IncapacitatedChildCredit', 'Incapacitated Child Credit'],
      ['DependentRelativeCredit',  'Dependent Relative Credit'],
      ['BlindCredit',              'Blind Person\'s Tax Credit'],
      ['GuideDogCredit',           'Guide Dog Allowance'],
      ['WidowedParentCredit',      'Widowed Parent Credit'],
    ];
    nrMap.forEach(function(pair) {
      var amt = num(crd[pair[0]]);
      if (amt > 0) addCredit(pair[0], amt, false, pair[1]);
    });

    // Medical expenses relief (treated as NR credit against IT)
    if (medRelief > 0) {
      addCredit('MedicalExpensesRelief', medRelief, false, 'Health Expenses Relief (s.469)');
    }

    // Tuition fees relief
    if (tuitionRelief > 0) {
      addCredit('TuitionFeesRelief', tuitionRelief, false, 'Tuition Fees Relief (s.473A)');
    }

    // Refundable credits
    var refCredits = ['RentCredit', 'MortgageInterestCredit'];
    refCredits.forEach(function(id) {
      var amt = num(crd[id]);
      if (amt > 0) {
        var label = id === 'RentCredit' ? 'Rent Tax Credit' : 'Mortgage Interest Relief';
        addCredit(id, amt, true, label);
      }
    });

    // DWT credit (refundable — on account of IT)
    if (dwtCredit > 0) {
      addCredit('DWTCredit', dwtCredit, true, 'DWT Credit (Irish dividends)');
    }

    // PSWT / RCT credit
    if (num(crd.PSWTCredit) > 0) {
      addCredit('PSWTCredit', num(crd.PSWTCredit), true, 'PSWT / RCT Credit');
    }

    // Custom credits
    if (Array.isArray(crd.custom)) {
      crd.custom.forEach(function(c) {
        if (c && num(c.amount) > 0) {
          addCredit('custom_' + c.name, num(c.amount), !!c.refundable, c.name);
        }
      });
    }

    return list;
  }

  // ─── Apply credit caps and floor IT at zero ────────────────────────────────
  function _applyCreditCaps(grossIT, empIncome, earnedIncome, credits) {
    var nrCredits  = credits.filter(function(c) { return !c.refundable; });
    var refCredits = credits.filter(function(c) { return c.refundable; });

    var totalNRRequested = 0;
    var totalNRApplied   = 0;
    var cappedDetails    = [];

    // PAYE credit: cap at 20% of employment income if < €10,000
    // Earned Income Credit: lesser of Revenue max or 20% of earned income
    var payeApplied = 0;
    var processedNR = nrCredits.map(function(c) {
      var applied = c.amount;
      var capped  = false;
      var reason  = '';

      if (c.id === 'EmployeeCredit' && empIncome < 10000) {
        var maxPAYE = round2(empIncome * 0.20);
        if (applied > maxPAYE) { applied = maxPAYE; capped = true; reason = 'Capped at 20% of employment income (< €10,000)'; }
      }

      if (c.id === 'EarnedIncomeCredit') {
        var r = global.RATES_CONFIG ? global.RATES_CONFIG.CREDITS.EarnedIncomeCredit.amount : 2000;
        var pctCap = round2(earnedIncome * 0.20);
        var maxEIC = Math.min(r, pctCap);
        // Combined PAYE + EIC cannot exceed PAYE max
        var combinedMax = r;
        if (payeApplied + maxEIC > combinedMax) maxEIC = Math.max(0, combinedMax - payeApplied);
        if (applied > maxEIC) { applied = maxEIC; capped = true; reason = 'Lesser of Revenue max or 20% of earned income; combined PAYE+EIC cap'; }
      }

      if (c.id === 'EmployeeCredit') payeApplied = applied;

      totalNRRequested += c.amount;
      totalNRApplied   += applied;

      if (capped) cappedDetails.push({ id: c.id, label: c.label, requested: c.amount, applied: applied, reason: reason });
      return Object.assign({}, c, { appliedAmount: applied, capped: capped, reason: reason });
    });

    // Floor gross IT at zero
    var unusedNR = Math.max(0, totalNRApplied - grossIT);
    var netIT    = Math.max(0, grossIT - totalNRApplied);

    // Refundable credits applied after
    var totalRefundable = refCredits.reduce(function(s, c) { return s + c.amount; }, 0);

    return {
      list: processedNR.concat(refCredits.map(function(c) { return Object.assign({}, c, { appliedAmount: c.amount }); })),
      nrCredits: processedNR,
      refundableCredits: refCredits,
      totalNRRequested: round2(totalNRRequested),
      totalNRApplied: round2(totalNRApplied),
      unusedNR: round2(unusedNR),
      netIT: round2(netIT),
      totalRefundable: round2(totalRefundable),
      cappedDetails: cappedDetails,
      grossIT: grossIT,
    };
  }

  // ─── PRSI calculation ──────────────────────────────────────────────────────
  function _calcPRSI(R, args) {
    var emp       = args.emp;
    var se        = args.se;
    var dirs      = args.dirs;
    var rental    = args.rental;
    var dividends = args.dividends;
    var foreign   = args.foreign;
    var other     = args.other;
    var prsiCls   = args.prsiCls || 'A1';
    var age       = args.age || 0;

    // Age 70+ exempt
    if (age >= 70) {
      return { classA: 0, classS: 0, classK: 0, total: 0, breakdown: [],
               note: 'Exempt — age 70+' };
    }

    // Modified rates (B/C/D/M)
    var isModified = (prsiCls === 'M' || prsiCls === 'B' || prsiCls === 'C' || prsiCls === 'D');
    if (isModified) {
      var unearned = rental + dividends + foreign + other;
      var classK = 0;
      if (unearned > R.PRSI.classK.threshold) {
        classK = round2(unearned * R.PRSI.classK.rate);
      }
      return { classA: 0, classS: 0, classK: classK, total: classK,
               breakdown: [{ label: 'Unearned income — Class K', base: unearned, rate: R.PRSI.classK.rate, charge: classK }],
               note: 'Modified rate contributor' };
    }

    var PA = R.PRSI.classA;
    var PS = R.PRSI.classS;
    var PK = R.PRSI.classK;
    var breakdown = [];
    var classA = 0, classS = 0, classK = 0;

    // Class A: employment income
    if (emp > 0) {
      var annualExempt = PA.weeklyExempt * 52;
      if (emp <= annualExempt) {
        breakdown.push({ label: 'Employment — Class A', base: emp, rate: PA.rate, charge: 0, note: 'Below weekly exempt threshold' });
      } else {
        var weeklyEarnings = emp / 52;
        var annualCredit = 0;
        if (weeklyEarnings > PA.weeklyExempt && weeklyEarnings <= PA.weeklyCredit.hiThreshold) {
          var creditPerWk = Math.max(0, PA.weeklyCredit.max
            - (PA.weeklyCredit.max / (PA.weeklyCredit.hiThreshold - PA.weeklyExempt))
            * (weeklyEarnings - PA.weeklyExempt));
          annualCredit = Math.round(creditPerWk * 52);
        }
        var rawA = Math.round(emp * PA.rate);
        classA = Math.max(0, rawA - annualCredit);
        breakdown.push({ label: 'Employment — Class A @ ' + (PA.rate * 100).toFixed(1) + '%',
                         base: emp, rate: PA.rate, charge: classA, credit: annualCredit });
      }
    }

    // Class S: self-employed + directors
    var seBase = se + dirs;
    if (seBase > 0) {
      var totalAllIncome = emp + seBase + rental + dividends + foreign + other;
      if (totalAllIncome < 5000) {
        breakdown.push({ label: 'Self-employed/directors — Class S', base: seBase, rate: PS.rate, charge: 0, note: 'Total income < €5,000 — exempt' });
      } else {
        var rawS = Math.round(seBase * PS.rate);
        classS = Math.max(rawS, PS.minAnnual);
        breakdown.push({ label: 'Self-employed / directors — Class S @ ' + (PS.rate * 100).toFixed(1) + '%',
                         base: seBase, rate: PS.rate, charge: classS, note: 'Via self-assessment' });
      }
    }

    // Class K or SE: unearned income (rental, dividends, foreign)
    // DIRT deposit excluded — final liability
    var unearnedBase = rental + dividends + foreign + other;
    if (unearnedBase > 0) {
      var isSE = seBase > 0;
      if (isSE) {
        // For SE: unearned included in Class S base
        var combinedBase = seBase + unearnedBase;
        var rawSC = Math.round(combinedBase * PS.rate);
        var newClassS = Math.max(rawSC, PS.minAnnual);
        var delta = newClassS - classS;
        classS = newClassS;
        if (delta > 0) {
          breakdown.push({ label: 'Unearned income included in Class S', base: unearnedBase, rate: PS.rate, charge: delta });
        }
      } else {
        if (unearnedBase <= PK.threshold) {
          breakdown.push({ label: 'Unearned income — Class K', base: unearnedBase, rate: PK.rate, charge: 0,
                           note: 'Below €' + PK.threshold.toLocaleString() + ' threshold — exempt (PAYE employee)' });
        } else {
          classK = round2(unearnedBase * PK.rate);
          breakdown.push({ label: 'Unearned income — Class K @ ' + (PK.rate * 100).toFixed(1) + '%',
                           base: unearnedBase, rate: PK.rate, charge: classK });
        }
      }
    }

    var total = round2(classA + classS + classK);
    return { classA: classA, classS: classS, classK: classK, total: total, breakdown: breakdown };
  }

  // ─── Build warnings ────────────────────────────────────────────────────────
  function _buildWarnings(args) {
    var warnings = [];
    if (args.pensionExcess > 0) {
      warnings.push({ type: 'pension', message: 'Pension contribution exceeds Revenue age-band cap. Excess of €' + args.pensionExcess.toLocaleString() + ' is not deductible.' });
    }
    if (args.unusedNR > 0) {
      warnings.push({ type: 'credits', message: 'Non-refundable credits of €' + args.unusedNR.toLocaleString() + ' exceed gross IT — unused portion is forfeited (cannot be carried forward).' });
    }
    if (args.uscExempt) {
      warnings.push({ type: 'usc', message: 'Income is below the USC exemption threshold (€13,000) — USC is nil.' });
    }
    if (args.age >= 65) {
      warnings.push({ type: 'age', message: 'Client is aged 65+ — check income exemption limits and age credit.' });
    }
    return warnings;
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  var COMPUTATION_ENGINE = {
    calculate: calculate,
    // Expose sub-calculators for testing
    _calcUSC: function(income, uscType) { return getRates().calculateUSC(income, uscType); },
    _calcPRSI: _calcPRSI,
    _applyCreditCaps: _applyCreditCaps,
  };

  global.COMPUTATION_ENGINE = COMPUTATION_ENGINE;

})(typeof window !== 'undefined' ? window : this);
