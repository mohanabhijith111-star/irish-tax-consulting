// ═══════════════════════════════════════════════════════════════════════════
// SPOUSE UI BINDING — Phase 2.4
// SpouseUIBinding class — manages the spouse-mode UI toggle,
// side-by-side proforma rendering, and joint balance row
//
// Depends on:
//   spouse-computation.js      → SpouseComputation
//   spouse-proforma-builder.js → SpouseProformaBuilder / PROFORMA_BUILDER.buildSpouseProformaHTML
//   result-summary-renderer.js → ResultSummaryRenderer  (optional)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  function euro(n) {
    return '\u20ac' + Math.abs(n || 0).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * SpouseUIBinding
   * Manages UI state for married / joint-assessment mode.
   * Listens for assessment mode changes and renders the appropriate proforma.
   *
   * @param {Object} opts
   * @param {string} opts.containerSelector      — CSS selector for results output (default: '#resultsArea')
   * @param {string} opts.resultSummarySelector  — CSS selector for summary box  (optional)
   * @param {Object} opts.spouseComputation      — SpouseComputation instance    (optional)
   * @param {Object} opts.resultRenderer         — ResultSummaryRenderer instance (optional)
   */
  function SpouseUIBinding(opts) {
    opts = opts || {};
    this.containerSelector     = opts.containerSelector     || '#resultsArea';
    this.resultSummarySelector = opts.resultSummarySelector || '#result-summary';
    this.spouseComp            = opts.spouseComputation     || (global.SpouseComputation
      ? new global.SpouseComputation({})
      : null);
    this.resultRenderer = opts.resultRenderer
      || (global.ResultSummaryRenderer
          ? new global.ResultSummaryRenderer({ container: this.resultSummarySelector })
          : null);

    this._spouseEnabled    = false;
    this._assessableSpouse = 's1';
    this._lastS1Result     = null;
    this._lastS2Result     = null;
    this._eventHandlers    = {};

    // Inject CSS
    this._ensureCSS();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Enable or disable spouse (joint) mode.
   * Triggering this will show/hide the spouse-2 input column.
   * @param {boolean} enabled
   * @returns {SpouseUIBinding}
   */
  SpouseUIBinding.prototype.setSpouseMode = function(enabled) {
    this._spouseEnabled = !!enabled;
    this._applySpouseColumnVisibility();
    this._emit('modeChange', { spouseEnabled: this._spouseEnabled });
    return this;
  };

  /** @returns {boolean} Whether spouse mode is active */
  SpouseUIBinding.prototype.isSpouseMode = function() {
    return this._spouseEnabled;
  };

  /**
   * Set the assessable spouse ('s1' or 's2')
   * @param {'s1'|'s2'} spouse
   * @returns {SpouseUIBinding}
   */
  SpouseUIBinding.prototype.setAssessableSpouse = function(spouse) {
    this._assessableSpouse = (spouse === 's2') ? 's2' : 's1';
    return this;
  };

  /**
   * Render a side-by-side joint proforma from two computation results.
   *
   * @param {Object} s1Result     — COMPUTATION_ENGINE result for Spouse 1
   * @param {Object} s2Result     — COMPUTATION_ENGINE result for Spouse 2
   * @param {Object} [clientDetails] — { spouse1Name, spouse2Name, taxYear, refNo }
   * @returns {SpouseUIBinding}
   */
  SpouseUIBinding.prototype.renderJointProforma = function(s1Result, s2Result, clientDetails) {
    this._lastS1Result = s1Result;
    this._lastS2Result = s2Result;

    var container = document.querySelector(this.containerSelector);
    if (!container) return this;

    // Resolve builder
    var builder = global.SpouseProformaBuilder
                || (global.PROFORMA_BUILDER && global.PROFORMA_BUILDER.buildSpouseProformaHTML
                    ? global.PROFORMA_BUILDER : null);

    if (builder && typeof builder.buildSpouseProformaHTML === 'function') {
      container.innerHTML = builder.buildSpouseProformaHTML(s1Result, s2Result, clientDetails || {});
    } else {
      container.innerHTML = this._fallbackJointHTML(s1Result, s2Result, clientDetails);
    }

    // Hide placeholder if present
    var ph = document.getElementById('proformaPlaceholder');
    if (ph) ph.style.display = 'none';

    // Update result summary
    if (this.resultRenderer && s1Result && s2Result) {
      this.resultRenderer.renderJoint(s1Result, s2Result);
    }

    return this;
  };

  /**
   * Append a combined joint balance bar to the result area.
   * (Useful when using the existing single-proforma layout in joint mode.)
   * @param {number} s1Balance
   * @param {number} s2Balance
   * @returns {SpouseUIBinding}
   */
  SpouseUIBinding.prototype.renderJointBalanceBar = function(s1Balance, s2Balance) {
    var combined = Math.round(((s1Balance || 0) + (s2Balance || 0)) * 100) / 100;
    var isRefund = combined < 0;
    var cls  = isRefund ? 'sub-jbb-ref' : 'sub-jbb-pay';
    var lbl  = isRefund ? 'TOTAL REFUND DUE' : 'TOTAL TAX PAYABLE';

    var html = [
      '<div class="sub-jbb ' + cls + '" role="region" aria-label="Joint combined balance">',
      '  <div class="sub-jbb-inner">',
      '    <div class="sub-jbb-breakdown">',
      '      <span class="sub-jbb-sp">Spouse 1:',
      '        <strong class="' + (s1Balance < 0 ? 'sub-jbb-g' : 'sub-jbb-r') + '">' +
                (s1Balance < 0 ? 'Refund ' : 'Payable ') + euro(Math.abs(s1Balance)) +
              '</strong>',
      '      </span>',
      '      <span class="sub-jbb-plus">+</span>',
      '      <span class="sub-jbb-sp">Spouse 2:',
      '        <strong class="' + (s2Balance < 0 ? 'sub-jbb-g' : 'sub-jbb-r') + '">' +
                (s2Balance < 0 ? 'Refund ' : 'Payable ') + euro(Math.abs(s2Balance)) +
              '</strong>',
      '      </span>',
      '    </div>',
      '    <div>',
      '      <div class="sub-jbb-lbl">' + lbl + '</div>',
      '      <div class="sub-jbb-amt">' + euro(Math.abs(combined)) + '</div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');

    var container = document.querySelector(this.containerSelector);
    if (container) container.insertAdjacentHTML('beforeend', html);
    return this;
  };

  /**
   * Auto-bind the existing page's assessment mode radios and assessable spouse radios.
   * Switches spouse column visibility when the user changes assessment mode.
   * @returns {SpouseUIBinding}
   */
  SpouseUIBinding.prototype.bindAssessmentModeRadios = function() {
    var self = this;

    // Assessment mode (single / joint / separate / treatment)
    document.querySelectorAll('[name="assessMode"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var isMarried = (radio.value !== 'single');
        self.setSpouseMode(isMarried);
      });
    });

    // Assessable spouse radios
    document.querySelectorAll('[name="assessableSpouse"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        self.setAssessableSpouse(radio.value);
      });
    });

    // Apply initial state from current selection
    var modeEl = document.querySelector('[name="assessMode"]:checked');
    if (modeEl) self.setSpouseMode(modeEl.value !== 'single');

    var aspEl = document.querySelector('[name="assessableSpouse"]:checked');
    if (aspEl) self.setAssessableSpouse(aspEl.value);

    return this;
  };

  /** Register an event handler */
  SpouseUIBinding.prototype.on = function(event, fn) {
    if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
    this._eventHandlers[event].push(fn);
    return this;
  };

  // ── Internal ─────────────────────────────────────────────────────────────────

  SpouseUIBinding.prototype._applySpouseColumnVisibility = function() {
    // Show/hide the spouse-2 income card
    var s2Cards = document.querySelectorAll('.spb-col-s2, [data-spouse="s2"]');
    s2Cards.forEach(function(el) {
      el.style.display = this._spouseEnabled ? '' : 'none';
    }.bind(this));
  };

  SpouseUIBinding.prototype._fallbackJointHTML = function(s1, s2, cd) {
    var b1 = (s1 && s1.summary && s1.summary.overallBalance) || 0;
    var b2 = (s2 && s2.summary && s2.summary.overallBalance) || 0;
    var combined = Math.round((b1 + b2) * 100) / 100;
    var isRefund = combined < 0;
    return [
      '<div style="border:2px solid #1c3557;border-radius:4px;overflow:hidden;margin-bottom:14px">',
      '  <div style="background:#1c3557;color:#fff;padding:10px 16px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">',
      '    Joint Assessment Summary</div>',
      '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">',
      '    <div style="padding:14px 16px;border-right:1px solid #e5e7eb">',
      '      <div style="font-size:10px;font-weight:700;color:#6b7280;margin-bottom:4px">SPOUSE 1</div>',
      '      <div style="font-family:\'Courier New\',monospace;font-size:16px;font-weight:700;color:' + (b1 < 0 ? '#15803d' : '#b91c1c') + '">' +
          euro(Math.abs(b1)) + '</div>',
      '      <div style="font-size:10px;color:#6b7280">' + (b1 < 0 ? 'Refund Due' : 'Tax Payable') + '</div>',
      '    </div>',
      '    <div style="padding:14px 16px">',
      '      <div style="font-size:10px;font-weight:700;color:#6b7280;margin-bottom:4px">SPOUSE 2</div>',
      '      <div style="font-family:\'Courier New\',monospace;font-size:16px;font-weight:700;color:' + (b2 < 0 ? '#15803d' : '#b91c1c') + '">' +
          euro(Math.abs(b2)) + '</div>',
      '      <div style="font-size:10px;color:#6b7280">' + (b2 < 0 ? 'Refund Due' : 'Tax Payable') + '</div>',
      '    </div>',
      '  </div>',
      '  <div style="background:' + (isRefund ? '#f0fdf4' : '#fef2f2') + ';border-top:2px solid ' + (isRefund ? '#16a34a' : '#dc2626') + ';',
      '              padding:12px 16px;display:flex;justify-content:space-between;align-items:center">',
      '    <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:' + (isRefund ? '#15803d' : '#b91c1c') + '">' +
          (isRefund ? 'Total Refund Due' : 'Total Tax Payable') + '</span>',
      '    <span style="font-family:\'Courier New\',monospace;font-size:20px;font-weight:800;color:' + (isRefund ? '#15803d' : '#b91c1c') + '">' +
          euro(Math.abs(combined)) + '</span>',
      '  </div>',
      '</div>',
    ].join('');
  };

  SpouseUIBinding.prototype._emit = function(event, data) {
    var handlers = this._eventHandlers[event] || [];
    handlers.forEach(function(fn) {
      try { fn(data); } catch (e) {
        console.error('SpouseUIBinding: error in "' + event + '" handler', e);
      }
    });
  };

  SpouseUIBinding.prototype._ensureCSS = function() {
    if (document.getElementById('sub-css')) return;
    var style = document.createElement('style');
    style.id = 'sub-css';
    style.textContent = [
      /* Joint balance bar */
      '.sub-jbb{border-radius:4px;margin-top:12px;padding:12px 16px;border-top:3px solid}',
      '.sub-jbb-ref{background:#f0fdf4;border-color:#16a34a}',
      '.sub-jbb-pay{background:#fef2f2;border-color:#dc2626}',
      '.sub-jbb-inner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}',
      '.sub-jbb-breakdown{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px}',
      '.sub-jbb-sp{display:flex;gap:5px;align-items:center}',
      '.sub-jbb-plus{font-size:18px;color:#9ca3af;font-weight:300}',
      '.sub-jbb-g{color:#15803d}',
      '.sub-jbb-r{color:#b91c1c}',
      '.sub-jbb-lbl{font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase}',
      '.sub-jbb-ref .sub-jbb-lbl{color:#15803d}',
      '.sub-jbb-pay .sub-jbb-lbl{color:#b91c1c}',
      '.sub-jbb-amt{font-family:"Courier New",monospace;font-size:20px;font-weight:800}',
      '.sub-jbb-ref .sub-jbb-amt{color:#15803d}',
      '.sub-jbb-pay .sub-jbb-amt{color:#b91c1c}',
    ].join('\n');
    document.head.appendChild(style);
  };

  // ── Expose ──────────────────────────────────────────────────────────────────
  global.SpouseUIBinding = SpouseUIBinding;

  console.log('ITC Phase 2.4: SpouseUIBinding loaded.');

})(typeof window !== 'undefined' ? window : this);
