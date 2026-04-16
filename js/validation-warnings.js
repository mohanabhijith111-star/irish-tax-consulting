// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION WARNINGS — Phase 2.2
// Inline validation for Irish income tax form inputs
// Depends on: nothing (standalone)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ── Thresholds ─────────────────────────────────────────────────────────────
  // Default thresholds (used when RATES_CONFIG is not loaded)
  var FORM12_RENTAL_LIMIT       = 5000;   // Form 12 rental income ceiling — configurable via RATES_CONFIG
  var MORTGAGE_INTEREST_CAP_STD = 1250;   // single
  var MORTGAGE_INTEREST_CAP_MRD = 2500;   // married
  var RENT_CREDIT_SINGLE_MAX    = 1000;
  var RENT_CREDIT_MARRIED_MAX   = 2000;

  /**
   * Read a threshold from RATES_CONFIG if available, otherwise use the supplied default.
   * This makes limits configurable and multi-year-aware via RATES_CONFIG.
   *
   * @param {string} key       — optional future key (e.g. 'form12RentalLimit')
   * @param {number} fallback  — default value when config not available
   * @returns {number}
   */
  function _threshold(key, fallback) {
    var rc = (typeof RATES_CONFIG !== 'undefined' && RATES_CONFIG);
    if (rc && typeof rc.getThreshold === 'function') {
      var v = rc.getThreshold(key);
      if (v != null && !isNaN(v)) return v;
    }
    return fallback;
  }

  /**
   * ValidationWarnings
   * Collects and renders inline validation messages.
   *
   * @param {Object} opts
   * @param {string|Element} opts.container  CSS selector or DOM element for the warning output
   */
  function ValidationWarnings(opts) {
    opts = opts || {};
    this.container = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : (opts.container || null);
    this.warnings = [];
    _ensureCSS();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Remove all warnings */
  ValidationWarnings.prototype.clear = function() {
    this.warnings = [];
    if (this.container) this.container.innerHTML = '';
    return this;
  };

  /**
   * Add a warning/error/info message
   * @param {'error'|'warning'|'info'} type
   * @param {string} message
   * @param {string} [field]  field key for grouping
   */
  ValidationWarnings.prototype.add = function(type, message, field) {
    this.warnings.push({ type: type, message: message, field: field || null });
    return this;
  };

  // ── Specific checkers ────────────────────────────────────────────────────────

  /** Check Form 12 rental limit (€5,000 by default, configurable via RATES_CONFIG) */
  ValidationWarnings.prototype.checkRentalLimit = function(rentalIncome, formType) {
    var limit = _threshold('form12RentalLimit', FORM12_RENTAL_LIMIT);
    if (formType === 'f12' && rentalIncome > limit) {
      this.add('error',
        'Form 12 restricted: Rental income (\u20AC' + _fmt(rentalIncome) + ') exceeds the \u20AC' + _fmt(limit) + ' limit. A Form 11 is required.',
        'rental');
    }
    return this;
  };

  /** Check Mortgage Interest Relief cap */
  ValidationWarnings.prototype.checkMortgageInterest = function(mortgageCredit, assessmentType) {
    var cap = (assessmentType === 'Married') ? MORTGAGE_INTEREST_CAP_MRD : MORTGAGE_INTEREST_CAP_STD;
    if (mortgageCredit > cap) {
      this.add('warning',
        'Mortgage Interest Relief capped at \u20AC' + _fmt(cap) + ' for ' + (assessmentType || 'Single') + ' assessment. Excess (\u20AC' + _fmt(mortgageCredit - cap) + ') will not be allowed.',
        'mortgage');
    }
    return this;
  };

  /** Check pension contribution cap */
  ValidationWarnings.prototype.checkPensionCap = function(pensionContrib, pensionMax) {
    var excess = pensionContrib - (pensionMax || 0);
    if (pensionMax > 0 && excess > 0) {
      this.add('warning',
        'Pension contributions (\u20AC' + _fmt(pensionContrib) + ') exceed the age-related cap (\u20AC' + _fmt(Math.round(pensionMax)) + '). Excess \u20AC' + _fmt(Math.round(excess)) + ' will not be relieved.',
        'pension');
    }
    return this;
  };

  /** Check Rent Tax Credit limit */
  ValidationWarnings.prototype.checkRentCredit = function(rentCredit, assessmentType) {
    var max = (assessmentType === 'Married') ? RENT_CREDIT_MARRIED_MAX : RENT_CREDIT_SINGLE_MAX;
    if (rentCredit > max) {
      this.add('warning',
        'Rent Tax Credit capped at \u20AC' + _fmt(max) + ' for ' + (assessmentType || 'Single') + ' assessment.',
        'rent');
    }
    return this;
  };

  /** Check that an income source exists */
  ValidationWarnings.prototype.checkIncomeSource = function(grossIncome) {
    if (!grossIncome || grossIncome <= 0) {
      this.add('info', 'No income entered yet. Enter income figures on the left to generate a computation.', 'income');
    }
    return this;
  };

  /** Check foreign income requires Form 11 */
  ValidationWarnings.prototype.checkForeignIncome = function(foreignIncome, formType) {
    if (foreignIncome > 0 && formType === 'f12') {
      this.add('error',
        'Foreign income (\u20AC' + _fmt(foreignIncome) + ') present — Form 12 cannot be used. A Form 11 (ROS) is required.',
        'foreign');
    }
    return this;
  };

  /** Check CGT requires Form 11 */
  ValidationWarnings.prototype.checkCGT = function(cgtGain, formType) {
    if (cgtGain > 0 && formType === 'f12') {
      this.add('error',
        'Capital gains present — Form 12 cannot be used. A Form 11 (ROS) is required.',
        'cgt');
    }
    return this;
  };

  /** Check trade/self-employment requires Form 11 */
  ValidationWarnings.prototype.checkTradeIncome = function(tradeIncome, formType) {
    if (tradeIncome > 0 && formType === 'f12') {
      this.add('error',
        'Trade/self-employment income (\u20AC' + _fmt(tradeIncome) + ') present — Form 12 cannot be used. A Form 11 is required.',
        'trade');
    }
    return this;
  };

  /**
   * Run all standard checks against a COMPUTATION_ENGINE result object
   * @param {Object} result     — result from COMPUTATION_ENGINE.calculate()
   * @param {string} formType   — 'f11' | 'f12'
   */
  ValidationWarnings.prototype.validateResult = function(result, formType) {
    this.clear();
    if (!result) return this;

    var inc  = result.income   || {};
    var rel  = result.reliefs  || {};
    var crd  = result.credits  || {};
    var at   = result.assessmentType || 'Single';

    // Rental limit
    this.checkRentalLimit(inc.rental || 0, formType);

    // Foreign income
    this.checkForeignIncome(inc.foreignIncome || 0, formType);

    // CGT restriction
    var cgtGain = (result.cgt && result.cgt.gain) || 0;
    this.checkCGT(cgtGain, formType);

    // Trade/SE restriction on F12
    this.checkTradeIncome((inc.trade || 0) + (inc.directors || 0), formType);

    // Pension cap
    if (rel.pensionExcess > 0) {
      this.add('warning',
        'Pension contributions exceed allowable cap by \u20AC' + _fmt(Math.round(rel.pensionExcess)) + '. Excess will not be relieved.',
        'pension');
    }

    // Mortgage interest cap warning (check applied credits)
    var mortCredit = 0;
    if (crd.list) {
      crd.list.forEach(function(c) {
        if (c.id === 'MortgageInterestCredit') mortCredit = c.amount;
      });
    }
    this.checkMortgageInterest(mortCredit, at);

    // Unused NR credits warning
    if (crd.unusedNR && crd.unusedNR > 0) {
      this.add('info',
        'Non-refundable credits of \u20AC' + _fmt(Math.round(crd.unusedNR)) + ' could not be fully utilised against income tax (IT was below zero).',
        'credits');
    }

    return this;
  };

  /**
   * Validate raw situation object (before computation) — for real-time field checks
   * @param {Object} situation  — in COMPUTATION_ENGINE.calculate() input format
   * @param {string} formType   — 'f11' | 'f12'
   */
  ValidationWarnings.prototype.validateSituation = function(situation, formType) {
    this.clear();
    if (!situation) return this;

    var inc = situation.grossIncome || {};
    var rel = situation.reliefs    || {};
    var crd = situation.credits    || {};
    var at  = situation.assessmentType || 'Single';

    this.checkRentalLimit(inc.rental || 0, formType);
    this.checkForeignIncome(inc.foreignIncome || 0, formType);
    // situation.grossIncome.cgt = raw CGT gain (COMPUTATION_ENGINE input format)
    // This differs from validateResult which uses result.cgt.gain (engine output format)
    this.checkCGT(inc.cgt || 0, formType);
    this.checkTradeIncome((inc.trade || 0) + (inc.directors || 0), formType);
    this.checkMortgageInterest(crd.MortgageInterestCredit || 0, at);
    this.checkRentCredit(crd.RentCredit || 0, at);

    return this;
  };

  /** Render warnings into the container element */
  ValidationWarnings.prototype.render = function() {
    if (!this.container) return this;

    if (!this.warnings.length) {
      this.container.innerHTML = '';
      return this;
    }

    var html = this.warnings.map(function(w) {
      var icons = { error: '⛔', warning: '⚠️', info: 'ℹ️' };
      var cls   = { error: 'vw-error', warning: 'vw-warning', info: 'vw-info' };
      return '<div class="vw-item ' + (cls[w.type] || 'vw-info') + '">'
        + '<span class="vw-icon">' + (icons[w.type] || 'ℹ️') + '</span>'
        + '<span class="vw-msg">' + _esc(w.message) + '</span>'
        + '</div>';
    }).join('');

    this.container.innerHTML = '<div class="vw-list" role="region" aria-label="Validation warnings">' + html + '</div>';
    return this;
  };

  /** True if any error-level warning exists */
  ValidationWarnings.prototype.hasErrors = function() {
    return this.warnings.some(function(w) { return w.type === 'error'; });
  };

  /** Number of active warnings */
  ValidationWarnings.prototype.getCount = function() {
    return this.warnings.length;
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function _fmt(n) {
    return Math.abs(n || 0).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _ensureCSS() {
    if (document.getElementById('vw-css')) return;
    var style = document.createElement('style');
    style.id = 'vw-css';
    style.textContent = [
      '.vw-list{display:flex;flex-direction:column;gap:5px;padding:0;margin:8px 0}',
      '.vw-item{display:flex;align-items:flex-start;gap:7px;padding:7px 12px;border-radius:4px;font-size:11.5px;line-height:1.5}',
      '.vw-icon{flex-shrink:0;font-size:13px;line-height:1.4}',
      '.vw-msg{flex:1}',
      '.vw-error{background:#fef2f2;border:1px solid #fca5a5;border-left:3px solid #dc2626;color:#991b1b}',
      '.vw-warning{background:#fffbeb;border:1px solid #fcd34d;border-left:3px solid #f59e0b;color:#78350f}',
      '.vw-info{background:#eff6ff;border:1px solid #93c5fd;border-left:3px solid #3b82f6;color:#1e40af}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Expose ──────────────────────────────────────────────────────────────────
  global.ValidationWarnings = ValidationWarnings;

  console.log('ITC Phase 2.2: ValidationWarnings loaded.');

})(typeof window !== 'undefined' ? window : this);
