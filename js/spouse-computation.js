// ═══════════════════════════════════════════════════════════════════════════
// SPOUSE COMPUTATION — Phase 2.4
// SpouseComputation class — married couple / joint assessment calculations
//
// Depends on:
//   computation-engine-2025.js → COMPUTATION_ENGINE
//   rates-config-2025.js       → RATES_CONFIG
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ── 2025 constants (fallback if RATES_CONFIG not loaded) ──────────────────
  var DEFAULT_MARRIED_BASE      = 53000;   // €53,000 base band for assessable spouse
  var DEFAULT_MARRIED_INC_MAX   = 35000;   // €35,000 max transferable band increase
  var DEFAULT_MARRIED_CREDIT    = 4000;    // €4,000 married couple's credit total

  function round2(n) { return Math.round((n || 0) * 100) / 100; }

  function _getBands(rates) {
    if (!rates) return { base: DEFAULT_MARRIED_BASE, incMax: DEFAULT_MARRIED_INC_MAX };
    var b = rates.getTaxBand ? rates.getTaxBand('Married') : null;
    return {
      base:   (b && b.cutOff) || DEFAULT_MARRIED_BASE,
      incMax: DEFAULT_MARRIED_INC_MAX,
    };
  }

  /**
   * SpouseComputation
   * Performs separate computations for each spouse and combines them for joint assessment.
   *
   * @param {Object} opts
   * @param {Object} opts.computationEngine  — COMPUTATION_ENGINE instance (default: global)
   * @param {Object} opts.ratesConfig        — RATES_CONFIG instance (default: global)
   * @param {number} opts.taxYear            — tax year (default: 2025)
   */
  function SpouseComputation(opts) {
    opts = opts || {};
    this.engine  = opts.computationEngine || global.COMPUTATION_ENGINE || null;
    this.rates   = opts.ratesConfig       || global.RATES_CONFIG       || null;
    this.taxYear = opts.taxYear || 2025;
    this._lastResult = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Compute joint assessment for a married couple.
   *
   * Revenue rule: the standard rate band is the assessable spouse's €53,000 base,
   * PLUS the income of the NON-assessable spouse (capped at €35,000).
   *
   * @param {Object} situation1       — COMPUTATION_ENGINE situation for Spouse 1
   * @param {Object} situation2       — COMPUTATION_ENGINE situation for Spouse 2
   * @param {string} assessableSpouse — 's1' | 's2'  (who is the assessable spouse)
   * @returns {Object} joint computation result
   */
  SpouseComputation.prototype.computeJoint = function(situation1, situation2, assessableSpouse) {
    if (!this.engine) throw new Error('SpouseComputation: COMPUTATION_ENGINE not available. Load computation-engine-2025.js first.');

    assessableSpouse = assessableSpouse || 's1';

    // Run individual computations (using Married assessment type so personal credits are correct)
    var s1 = this.engine.calculate(_withType(situation1, 'Married', this.taxYear));
    var s2 = this.engine.calculate(_withType(situation2, 'Married', this.taxYear));

    var s1Taxable = s1.taxableIncome || 0;
    var s2Taxable = s2.taxableIncome || 0;
    var combined  = s1Taxable + s2Taxable;

    // Band increase = income of non-assessable spouse, capped at €35k
    var bands = _getBands(this.rates);
    var nonAssessableIncome = (assessableSpouse === 's1') ? s2Taxable : s1Taxable;
    var bandIncrease = Math.min(bands.incMax, nonAssessableIncome);
    var jointCutOff  = bands.base + bandIncrease;

    // Calculate IT on combined taxable income using joint cut-off
    var itStd  = round2(Math.min(combined, jointCutOff) * 0.20);
    var itHigh = round2(Math.max(0, combined - jointCutOff) * 0.40);
    var grossIT = round2(itStd + itHigh);

    // Credits: sum NR and refundable credits from both spouses
    var nrS1       = (s1.credits && s1.credits.totalNRApplied) || 0;
    var nrS2       = (s2.credits && s2.credits.totalNRApplied) || 0;
    var totalNR    = round2(nrS1 + nrS2 + (s1.reliefs.medRelief||0) + (s2.reliefs.medRelief||0)
                            + (s1.reliefs.tuitionRelief||0) + (s2.reliefs.tuitionRelief||0));
    var netIT      = round2(Math.max(0, grossIT - totalNR));

    var refS1      = (s1.totalRefundableCredits || 0);
    var refS2      = (s2.totalRefundableCredits || 0);
    var totalRef   = round2(refS1 + refS2);
    var netITAfterRef = round2(netIT - totalRef);

    // USC & PRSI are assessed individually (not combined)
    var totalUSC   = round2((s1.usc && s1.usc.total || 0) + (s2.usc && s2.usc.total || 0));
    var totalPRSI  = round2((s1.prsi && s1.prsi.total || 0) + (s2.prsi && s2.prsi.total || 0));

    // Tax paid (from each situation)
    var p1 = situation1.taxPaid || {};
    var p2 = situation2.taxPaid || {};
    var itPaid1   = (p1.incomeTax || 0);
    var itPaid2   = (p2.incomeTax || 0);
    var uscPaid1  = (p1.usc || 0);
    var uscPaid2  = (p2.usc || 0);
    var prsiPaid1 = (p1.prsi || 0);
    var prsiPaid2 = (p2.prsi || 0);

    var netITPayable   = round2(netITAfterRef - (itPaid1 + itPaid2));
    var netUSCPayable  = round2(totalUSC - (uscPaid1 + uscPaid2));
    var netPRSIPayable = round2(totalPRSI - (prsiPaid1 + prsiPaid2));
    var overallBalance = round2(netITPayable + netUSCPayable + netPRSIPayable);

    var result = {
      type:             'joint',
      taxYear:          this.taxYear,
      assessableSpouse: assessableSpouse,
      spouse1:          s1,
      spouse2:          s2,

      combinedTaxableIncome: combined,
      bandIncrease:          bandIncrease,
      jointCutOff:           jointCutOff,

      incomeTax: {
        standardRateBand: Math.min(combined, jointCutOff),
        standardRateTax:  itStd,
        higherRateBand:   Math.max(0, combined - jointCutOff),
        higherRateTax:    itHigh,
        grossIT:          grossIT,
      },

      credits: {
        totalNRCredits:  totalNR,
        totalRefCredits: totalRef,
        netIT:           netIT,
      },

      netIT:              netIT,
      netITAfterRefundable: netITAfterRef,

      usc:  { total: totalUSC,  spouse1: s1.usc,  spouse2: s2.usc  },
      prsi: { total: totalPRSI, spouse1: s1.prsi, spouse2: s2.prsi },

      summary: {
        grossIT:          grossIT,
        totalUSC:         totalUSC,
        totalPRSI:        totalPRSI,
        lessNRCredits:    totalNR,
        lessRefCredits:   totalRef,
        netITPayable:     netITPayable,
        netUSCPayable:    netUSCPayable,
        netPRSIPayable:   netPRSIPayable,
        overallBalance:   overallBalance,
        isRefund:         overallBalance < 0,
        taxPaid: {
          incomeTax: itPaid1 + itPaid2,
          usc:       uscPaid1 + uscPaid2,
          prsi:      prsiPaid1 + prsiPaid2,
        },
      },
    };

    this._lastResult = result;
    return result;
  };

  /**
   * Compute separate assessment (each spouse is taxed independently).
   * By default uses Single assessment type for each (separate treatment).
   *
   * @param {Object} situation1
   * @param {Object} situation2
   * @param {'separate'|'treatment'} [mode] — 'separate' = half married band; 'treatment' = single band
   * @returns {Object}
   */
  SpouseComputation.prototype.computeSeparate = function(situation1, situation2, mode) {
    if (!this.engine) throw new Error('SpouseComputation: COMPUTATION_ENGINE not available.');

    var at = (mode === 'treatment') ? 'Single' : 'Single'; // Revenue uses single band for separate treatment

    var s1 = this.engine.calculate(_withType(situation1, at, this.taxYear));
    var s2 = this.engine.calculate(_withType(situation2, at, this.taxYear));

    var b1 = (s1.summary && s1.summary.overallBalance) || 0;
    var b2 = (s2.summary && s2.summary.overallBalance) || 0;

    var result = {
      type:    mode || 'separate',
      taxYear: this.taxYear,
      spouse1: s1,
      spouse2: s2,
      summary: {
        spouse1Balance:  b1,
        spouse2Balance:  b2,
        combinedBalance: round2(b1 + b2),
        isRefund:        (b1 + b2) < 0,
      },
    };

    this._lastResult = result;
    return result;
  };

  /**
   * Compute both joint and separate assessments and recommend the most beneficial.
   * "Most beneficial" = lowest absolute balance (smallest tax payable or largest refund).
   *
   * @param {Object} situation1
   * @param {Object} situation2
   * @param {string} [assessableSpouse] — 's1' | 's2'
   * @returns {Object} { joint, separate, recommendation, jointBalance, separateBalance }
   */
  SpouseComputation.prototype.optimiseAllocation = function(situation1, situation2, assessableSpouse) {
    var joint  = this.computeJoint(situation1, situation2, assessableSpouse || 's1');
    var sep    = this.computeSeparate(situation1, situation2, 'treatment');

    var jBal = joint.summary.overallBalance;
    var sBal = sep.summary.combinedBalance;

    return {
      joint:           joint,
      separate:        sep,
      recommendation:  Math.abs(jBal) <= Math.abs(sBal) ? 'joint' : 'separate',
      jointBalance:    jBal,
      separateBalance: sBal,
      savingIfJoint:   round2(Math.abs(sBal) - Math.abs(jBal)),
    };
  };

  /**
   * Calculate the transferable allowance available from the higher-income spouse.
   * Under joint assessment, the non-assessable spouse's income can "increase"
   * the standard rate band by up to €35,000.
   *
   * @param {number} s1TaxableIncome
   * @param {number} s2TaxableIncome
   * @param {string} assessableSpouse — 's1' | 's2'
   * @returns {Object} { nonAssessableIncome, bandIncrease, unusedBand }
   */
  SpouseComputation.prototype.calculateTransferableAllowance = function(s1TaxableIncome, s2TaxableIncome, assessableSpouse) {
    var bands = _getBands(this.rates);
    var nonAssessableIncome = (assessableSpouse === 's1') ? s2TaxableIncome : s1TaxableIncome;
    var bandIncrease  = Math.min(bands.incMax, nonAssessableIncome);
    var unusedBand    = Math.max(0, bands.incMax - nonAssessableIncome);

    return {
      nonAssessableIncome: nonAssessableIncome,
      maxTransferable:     bands.incMax,
      bandIncrease:        bandIncrease,
      unusedBand:          unusedBand,
      jointCutOff:         bands.base + bandIncrease,
    };
  };

  /** @returns {Object|null} Last computation result */
  SpouseComputation.prototype.getLastResult = function() {
    return this._lastResult;
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function _withType(situation, assessmentType, taxYear) {
    return Object.assign({}, situation, {
      assessmentType: assessmentType,
      taxYear:        taxYear,
    });
  }

  // ── Expose ──────────────────────────────────────────────────────────────────
  global.SpouseComputation = SpouseComputation;

  console.log('ITC Phase 2.4: SpouseComputation loaded.');

})(typeof window !== 'undefined' ? window : this);
