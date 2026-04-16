// ═══════════════════════════════════════════════════════════════════════════
// PROFORMA LIVE BINDING — Phase 2.2
// Manages real-time computation: debounces input changes, calls COMPUTATION_ENGINE,
// updates the live proforma, validation warnings, and result summary.
//
// Depends on:
//   rates-config-2025.js      → RATES_CONFIG
//   computation-engine-2025.js → COMPUTATION_ENGINE
//   proforma-builder-2025.js  → PROFORMA_BUILDER
//   validation-warnings.js    → ValidationWarnings  (optional)
//   result-summary-renderer.js → ResultSummaryRenderer (optional)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ── Utility ─────────────────────────────────────────────────────────────────
  function debounce(fn, ms) {
    var timer;
    return function() {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, ms || 300);
    };
  }

  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : Math.max(0, n); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  /**
   * ProformaLiveBinding
   * Binds input field changes to live computation and proforma updates.
   *
   * @param {Object} opts
   * @param {Object}  opts.computationEngine         — COMPUTATION_ENGINE instance (default: global)
   * @param {Object}  opts.proformaBuilder           — PROFORMA_BUILDER instance (default: global)
   * @param {Object}  opts.ratesConfig               — RATES_CONFIG instance (default: global)
   * @param {string}  opts.containerSelector         — CSS selector for proforma output (default: '#live-proforma')
   * @param {string}  opts.warningContainerSelector  — CSS selector for warnings output
   * @param {string}  opts.resultSummarySelector     — CSS selector for result summary output
   * @param {number}  opts.debounceMs                — Debounce delay in ms (default: 300)
   */
  function ProformaLiveBinding(opts) {
    opts = opts || {};
    this.engine        = opts.computationEngine  || global.COMPUTATION_ENGINE  || null;
    this.builder       = opts.proformaBuilder    || global.PROFORMA_BUILDER    || null;
    this.rates         = opts.ratesConfig        || global.RATES_CONFIG        || null;
    this.debounceMs    = opts.debounceMs != null ? opts.debounceMs : 300;
    this._spouseMode   = false;
    this._lastSituation = null;
    this._lastResult    = null;
    this._listeners     = [];
    this._eventHandlers = {};
    this._calculating   = false;

    // Resolve containers
    this.container = _resolveEl(opts.containerSelector   || '#live-proforma');

    // Sub-modules
    this.warnings = null;
    if (opts.warningContainerSelector && global.ValidationWarnings) {
      this.warnings = new global.ValidationWarnings({ container: opts.warningContainerSelector });
    }
    this.resultRenderer = null;
    if (opts.resultSummarySelector && global.ResultSummaryRenderer) {
      this.resultRenderer = new global.ResultSummaryRenderer({ container: opts.resultSummarySelector });
    }

    // Debounced internal runner
    this._debouncedRun = debounce(this._runComputation.bind(this), this.debounceMs);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Attach event listeners to input/select/textarea elements inside `scope`.
   * Uses event delegation so dynamically added rows are also covered.
   *
   * @param {string|Element} [scope]  — root element or selector (default: document.body)
   * @returns {ProformaLiveBinding}
   */
  ProformaLiveBinding.prototype.bind = function(scope) {
    var root = _resolveEl(scope) || document.body;
    var self  = this;

    var handler = function(e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) {
        self._debouncedRun();
      }
    };

    root.addEventListener('input',  handler);
    root.addEventListener('change', handler);
    this._listeners.push({ el: root, type: 'input',  fn: handler });
    this._listeners.push({ el: root, type: 'change', fn: handler });

    return this;
  };

  /**
   * Remove all event listeners attached by bind()
   * @returns {ProformaLiveBinding}
   */
  ProformaLiveBinding.prototype.unbind = function() {
    this._listeners.forEach(function(l) {
      l.el.removeEventListener(l.type, l.fn);
    });
    this._listeners = [];
    return this;
  };

  /**
   * Immediately run a computation (no debounce)
   * @returns {ProformaLiveBinding}
   */
  ProformaLiveBinding.prototype.run = function() {
    this._runComputation();
    return this;
  };

  /**
   * Enable or disable spouse/joint mode
   * @param {boolean} enabled
   * @returns {ProformaLiveBinding}
   */
  ProformaLiveBinding.prototype.toggleSpouseMode = function(enabled) {
    this._spouseMode = !!enabled;
    return this;
  };

  /** @returns {Object|null} Last COMPUTATION_ENGINE result */
  ProformaLiveBinding.prototype.getLastComputation = function() {
    return this._lastResult;
  };

  /** @returns {Object|null} Last situation passed to calculate() */
  ProformaLiveBinding.prototype.getLastSituation = function() {
    return this._lastSituation;
  };

  /**
   * Register an event handler
   * @param {'computed'|'error'|'warning'} event
   * @param {Function} fn
   * @returns {ProformaLiveBinding}
   */
  ProformaLiveBinding.prototype.on = function(event, fn) {
    if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
    this._eventHandlers[event].push(fn);
    return this;
  };

  // ── Internal ─────────────────────────────────────────────────────────────────

  ProformaLiveBinding.prototype._runComputation = function() {
    if (this._calculating) return; // prevent re-entrancy
    if (!this.engine || !this.builder) {
      // Fallback: if the page's own calculate() function exists, delegate to it
      if (typeof global.calculate === 'function') {
        try { global.calculate(); } catch (e) { /* silent */ }
      }
      return;
    }

    this._calculating = true;
    this._showSpinner(true);

    try {
      var situation = this._gatherSituation();
      this._lastSituation = situation;

      var result = this.engine.calculate(situation);
      this._lastResult = result;

      // Render proforma
      if (this.container) {
        var cd = this._gatherClientDetails();
        this.container.innerHTML = this.builder.buildProformaHTML(result, cd);
        // Hide placeholder if present
        var ph = document.getElementById('proformaPlaceholder');
        if (ph) ph.style.display = 'none';
      }

      // Render result summary
      if (this.resultRenderer) {
        this.resultRenderer.render(result);
      }

      // Render validation warnings
      if (this.warnings) {
        var ft = this._detectFormType();
        this.warnings.validateResult(result, ft);
        this.warnings.render();
      }

      this._emit('computed', result);

    } catch (err) {
      console.error('ProformaLiveBinding: computation error', err);
      if (this.container) {
        this.container.innerHTML = '<div style="padding:14px;color:#991b1b;font-size:12px;'
          + 'border:1px solid #fca5a5;border-radius:4px;background:#fef2f2">'
          + '\u26a0\ufe0f Computation error: ' + _esc(err.message || String(err)) + '</div>';
      }
      this._emit('error', err);
    } finally {
      this._calculating = false;
      this._showSpinner(false);
    }
  };

  /** Show/hide spinner on the calculate button */
  ProformaLiveBinding.prototype._showSpinner = function(on) {
    // Target the primary "Run Computation" button
    var btn = document.querySelector('button[onclick="calculate()"]')
           || document.getElementById('calculateBtn');
    if (!btn) return;
    if (on) {
      if (!btn.getAttribute('data-orig-text')) {
        btn.setAttribute('data-orig-text', btn.textContent);
      }
      btn.textContent = '\u23f3 Calculating\u2026';
      btn.disabled = true;
    } else {
      var orig = btn.getAttribute('data-orig-text');
      if (orig) btn.textContent = orig;
      btn.disabled = false;
    }
  };

  /** Detect current form type from UI */
  ProformaLiveBinding.prototype._detectFormType = function() {
    var overrideEl = document.getElementById('sitFormTypeOverride');
    if (overrideEl && overrideEl.value !== 'auto') return overrideEl.value;

    // Auto-detect: Form 11 chips
    var f11Chips = ['se', 'foreign', 'cgt', 'propdir'];
    var anyF11 = f11Chips.some(function(sit) {
      var el = document.querySelector('.sit-chip[data-sit="' + sit + '"]');
      return el && el.classList.contains('active');
    });
    return anyF11 ? 'f11' : 'f12';
  };

  /**
   * Gather a situation object from the current form state.
   * Reads the same DOM structure as the existing calculate() logic.
   */
  ProformaLiveBinding.prototype._gatherSituation = function() {
    // Assessment type
    var modeEl = document.querySelector('[name="assessMode"]:checked');
    var mode   = modeEl ? modeEl.value : 'single';
    var assessmentType = (mode === 'joint' || mode === 'separate') ? 'Married' : 'Single';
    if (mode === 'treatment') assessmentType = 'Married';

    // Tax year
    var taxYear = parseInt(val('globalYear')) || 2025;

    // Age from DOB
    var age = _ageFromDob(val('dob') || val('s1_dob')) || 40;

    // PRSI class
    var prsiCls = val('s1_prsi_class') || val('prsi_class') || 'A1';

    // Med card
    var medCardEl = document.querySelector('#s1_medcard, #medcard, [id$="_medcard"]');
    var medCard = medCardEl ? medCardEl.checked : false;

    // ── Income ────────────────────────────────────────────────────────────────
    // Employment: sum all emp_X_gross fields for s1 (and plain emp_gross)
    var emp = 0;
    document.querySelectorAll('[id$="_emp1_gross"],[id$="_emp2_gross"],[id$="_emp3_gross"]').forEach(function(el) {
      if (!el.id.startsWith('s2_')) emp += num(el.value);
    });
    emp += num(val('emp_gross')) + num(val('s1_emp1_gross'));
    // Deduplicate if both s1_emp1_gross and emp_gross refer to same field
    if (document.getElementById('s1_emp1_gross') === document.getElementById('emp_gross')) emp = num(val('emp_gross'));

    var bik       = num(val('s1_emp1_bik'))  + num(val('emp_bik'));
    var dsp       = num(val('s1_dsp'))       + num(val('dsp'));
    var trade     = num(val('s1_trade1_net'))+ num(val('trade_net'));
    var directors = num(val('s1_directors')) + num(val('directors'));

    // Rental: sum all prop rows
    var rental = 0;
    document.querySelectorAll('[id^="prop_"][id$="_net"],[id^="s1_prop_"][id$="_net"]').forEach(function(el) {
      rental += num(el.value);
    });
    // Also check legacy field names
    rental += num(val('rental_net')) + num(val('s1_rental_net'));

    var foreign   = num(val('s1_foreign_total'))  + num(val('foreign_total'));
    var dividends = num(val('s1_div_gross'))       + num(val('div_gross'));
    var deposit   = num(val('s1_deposit_gross'))   + num(val('deposit_gross'));
    var other     = num(val('s1_other_income'))    + num(val('other_income'));

    // CGT gain
    var cgtGain = 0;
    document.querySelectorAll('[id^="disp_gain_"],[id^="s1_disp_gain_"]').forEach(function(el) {
      cgtGain += Math.max(0, num(el.value));
    });

    // ── Reliefs ───────────────────────────────────────────────────────────────
    var pension      = num(val('s1_pension_contrib'))  + num(val('pension_contrib'));
    var capAllow     = num(val('s1_cap_allow'))         + num(val('cap_allow'));
    var flatRate     = num(val('s1_flat_rate'))         + num(val('flat_rate'));
    var wfh          = num(val('s1_wfh'))               + num(val('wfh_expenses'));
    var tradeLosses  = num(val('s1_trade_losses'))      + num(val('trade_losses'));
    var otherDed     = num(val('s1_other_ded'))         + num(val('other_deductions'));
    var medGross     = num(val('s1_med_gross'))         + num(val('med_gross'));
    var medRecovery  = num(val('s1_med_recovery'))      + num(val('med_recovery'));
    var tuitionFees  = num(val('s1_tuition_fees'))      + num(val('tuition_fees'));

    // ── Credits ───────────────────────────────────────────────────────────────
    var credits = {};
    // Read from creditStore if available (matches the existing app's data)
    if (global.creditStore && global.creditStore.s1) {
      global.creditStore.s1.forEach(function(c) {
        if (c.id) credits[c.id] = (credits[c.id] || 0) + (c.amount || 0);
      });
    } else {
      // Fallback: read [data-credit-id] inputs that are NOT inside a s2 block
      document.querySelectorAll('[data-credit-id]').forEach(function(el) {
        if (!el.closest('[data-spouse="s2"]')) {
          var id = el.getAttribute('data-credit-id');
          if (id) credits[id] = (credits[id] || 0) + num(el.value);
        }
      });
    }

    // ── Tax paid ──────────────────────────────────────────────────────────────
    var paidIT   = num(val('paid_it'))   + num(val('paid_prelim'));
    var paidUSC  = num(val('paid_usc'));
    var paidPRSI = num(val('paid_prsi'));
    var paidCGT  = num(val('paid_cgt'));

    return {
      assessmentType: assessmentType,
      taxYear:        taxYear,
      grossIncome: {
        employment:   emp,
        dsp:          dsp,
        trade:        trade,
        directors:    directors,
        rental:       rental,
        foreignIncome: foreign,
        dividends:    dividends,
        deposit:      deposit,
        other:        other,
        bik:          bik,
        cgt:          cgtGain,
      },
      reliefs: {
        pension:           pension,
        capitalAllowances: capAllow,
        flatRateExpenses:  flatRate,
        wfhExpenses:       wfh,
        tradeLosses:       tradeLosses,
        otherDeductions:   otherDed,
        medicalExpenses:   medGross,
        medicalRecovery:   medRecovery,
        tuitionFees:       tuitionFees,
      },
      credits:         credits,
      personalDetails: { age: age, medCard: medCard, prsiClass: prsiCls },
      taxPaid:         { incomeTax: paidIT, usc: paidUSC, prsi: paidPRSI, cgt: paidCGT },
    };
  };

  /** Gather client details from top card fields */
  ProformaLiveBinding.prototype._gatherClientDetails = function() {
    return {
      name:           val('clientName'),
      ppsn:           val('ppsNumber'),
      taxYear:        parseInt(val('globalYear')) || 2025,
      refNo:          val('fileRef'),
      assessmentType: (function() {
        var el = document.querySelector('[name="assessMode"]:checked');
        return el ? el.value : 'single';
      })(),
    };
  };

  ProformaLiveBinding.prototype._emit = function(event, data) {
    var handlers = this._eventHandlers[event] || [];
    handlers.forEach(function(fn) { try { fn(data); } catch (e) { /* silent */ } });
  };

  // ── Static helpers ──────────────────────────────────────────────────────────

  function _resolveEl(sel) {
    if (!sel) return null;
    if (typeof sel === 'string') return document.querySelector(sel);
    return sel;
  }

  function _ageFromDob(dob) {
    if (!dob) return null;
    var bd = new Date(dob);
    if (isNaN(bd.getTime())) return null;
    var now = new Date();
    var age = now.getFullYear() - bd.getFullYear();
    if (now.getMonth() < bd.getMonth() ||
        (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
    return age;
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Expose ──────────────────────────────────────────────────────────────────
  global.ProformaLiveBinding = ProformaLiveBinding;

  console.log('ITC Phase 2.2: ProformaLiveBinding loaded.');

})(typeof window !== 'undefined' ? window : this);
