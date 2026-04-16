// ═══════════════════════════════════════════════════════════════════════════
// RESULT SUMMARY RENDERER — Phase 2.2
// Renders a 3-cell summary box: Total Tax | Less Credits | Net Balance
// Depends on: nothing (standalone)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  /**
   * ResultSummaryRenderer
   * Renders a compact, colour-coded result summary box.
   *
   * @param {Object} opts
   * @param {string|Element} opts.container  CSS selector or DOM element
   */
  function ResultSummaryRenderer(opts) {
    opts = opts || {};
    this.container = typeof opts.container === 'string'
      ? document.querySelector(opts.container)
      : (opts.container || null);
    this._lastBalance = null;
    _ensureCSS();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Render the summary box from a COMPUTATION_ENGINE result object
   * @param {Object} computation — result from COMPUTATION_ENGINE.calculate()
   */
  ResultSummaryRenderer.prototype.render = function(computation) {
    if (!this.container) return this;

    if (!computation || !computation.summary) {
      this.container.innerHTML = '';
      return this;
    }

    var sum  = computation.summary;
    var inc  = computation.income || {};

    // ── Derive totals ───────────────────────────────────────────────────────
    var grossIT   = sum.grossIT   || 0;
    var totalUSC  = sum.totalUSC  || 0;
    var totalPRSI = sum.totalPRSI || 0;
    var cgtLiab   = sum.cgtLiability || 0;
    var dirtCharge = (computation.dirt && computation.dirt.charge) || 0;

    var totalTax  = grossIT + totalUSC + totalPRSI + cgtLiab + dirtCharge;

    var totalNRCredits  = sum.lessNRCredits  || 0;
    var totalRefCredits = sum.lessRefCredits || 0;
    var paid = sum.taxPaid || {};
    var totalPaid = (paid.incomeTax || 0) + (paid.usc || 0) + (paid.prsi || 0) + (paid.cgt || 0);

    var balance  = sum.overallBalance || 0;
    var isRefund = balance < 0;
    var absBalance = Math.abs(balance);

    // Effective tax rate = total tax (IT + USC + PRSI) / gross income (before any reliefs)
    var grossIncome = inc.grossIncome || 0;
    var effRate = grossIncome > 0 ? Math.min(100, (totalTax / grossIncome) * 100) : 0;

    var hasChanged = this._lastBalance !== null && this._lastBalance !== balance;
    this._lastBalance = balance;

    var animClass  = hasChanged ? ' rsr-animate' : '';
    var balCls     = isRefund ? 'rsr-refund' : 'rsr-payable';
    var balLabel   = isRefund ? 'Refund Due' : 'Tax Payable';
    var balAriaLbl = isRefund ? 'Refund due to you' : 'Tax you owe';

    this.container.innerHTML = [
      '<div class="rsr-wrap' + animClass + '" role="region" aria-label="Tax computation summary">',

      '  <!-- Cell 1: Total Tax & Charges -->',
      '  <div class="rsr-cell" aria-label="Total tax and charges">',
      '    <div class="rsr-label">Total Tax &amp; Charges</div>',
      '    <div class="rsr-value">' + _euro(totalTax) + '</div>',
      '    <div class="rsr-sub">IT \u20ac' + _fmtK(grossIT) + ' &middot; USC \u20ac' + _fmtK(totalUSC) + ' &middot; PRSI \u20ac' + _fmtK(totalPRSI) + '</div>',
      '  </div>',

      '  <!-- Cell 2: Credits Applied -->',
      '  <div class="rsr-cell" aria-label="Credits and tax already paid">',
      '    <div class="rsr-label">Less Credits &amp; Paid</div>',
      '    <div class="rsr-value">' + _euro(totalNRCredits + totalRefCredits + totalPaid) + '</div>',
      '    <div class="rsr-sub">Effective rate: ' + effRate.toFixed(1) + '%</div>',
      '  </div>',

      '  <!-- Cell 3: Net Balance -->',
      '  <div class="rsr-cell rsr-balance ' + balCls + '" aria-label="' + balAriaLbl + '">',
      '    <div class="rsr-label">' + balLabel + '</div>',
      '    <div class="rsr-value rsr-balance-amt" id="rsr-balance-amt">' + _euro(absBalance) + '</div>',
      '    <div class="rsr-sub">' + (isRefund ? 'Revenue will refund' : 'Amount due to Revenue') + '</div>',
      '  </div>',

      '</div>',
    ].join('\n');

    return this;
  };

  /**
   * Render a joint (married) summary with per-spouse breakdown
   * @param {Object} s1  — computation result for Spouse 1
   * @param {Object} s2  — computation result for Spouse 2
   */
  ResultSummaryRenderer.prototype.renderJoint = function(s1, s2) {
    if (!this.container) return this;

    var b1 = (s1 && s1.summary && s1.summary.overallBalance) || 0;
    var b2 = (s2 && s2.summary && s2.summary.overallBalance) || 0;
    var combined = Math.round((b1 + b2) * 100) / 100;
    var isRefund  = combined < 0;

    var html = [
      '<div class="rsr-joint-wrap" role="region" aria-label="Joint tax summary">',
      '  <div class="rsr-joint-hdr">Joint Assessment Summary</div>',
      '  <div class="rsr-joint-grid">',
      '    <div class="rsr-joint-col">',
      '      <div class="rsr-joint-name">Spouse 1</div>',
      '      <div class="rsr-joint-bal ' + (b1 < 0 ? 'rsr-refund' : 'rsr-payable') + '">' + _euro(Math.abs(b1)) + '</div>',
      '      <div class="rsr-joint-lbl">' + (b1 < 0 ? 'Refund' : 'Payable') + '</div>',
      '    </div>',
      '    <div class="rsr-joint-sep">+</div>',
      '    <div class="rsr-joint-col">',
      '      <div class="rsr-joint-name">Spouse 2</div>',
      '      <div class="rsr-joint-bal ' + (b2 < 0 ? 'rsr-refund' : 'rsr-payable') + '">' + _euro(Math.abs(b2)) + '</div>',
      '      <div class="rsr-joint-lbl">' + (b2 < 0 ? 'Refund' : 'Payable') + '</div>',
      '    </div>',
      '    <div class="rsr-joint-sep">=</div>',
      '    <div class="rsr-joint-col rsr-joint-total">',
      '      <div class="rsr-joint-name">Combined</div>',
      '      <div class="rsr-joint-bal ' + (isRefund ? 'rsr-refund' : 'rsr-payable') + ' rsr-large">' + _euro(Math.abs(combined)) + '</div>',
      '      <div class="rsr-joint-lbl">' + (isRefund ? 'Total Refund Due' : 'Total Tax Payable') + '</div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');

    this.container.innerHTML = html;
    return this;
  };

  /** Clear the container */
  ResultSummaryRenderer.prototype.clear = function() {
    if (this.container) this.container.innerHTML = '';
    this._lastBalance = null;
    return this;
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function _euro(n) {
    return '\u20ac' + Math.abs(n || 0).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function _fmtK(n) {
    n = Math.abs(n || 0);
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toFixed(0);
  }

  function _ensureCSS() {
    if (document.getElementById('rsr-css')) return;
    var style = document.createElement('style');
    style.id = 'rsr-css';
    style.textContent = [
      /* Wrapper */
      '.rsr-wrap{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;',
      '  border:2px solid #1c3557;border-radius:4px;overflow:hidden;margin:12px 0}',
      /* Animation */
      '@keyframes rsr-pop{0%,100%{transform:scale(1)}40%{transform:scale(1.07)}}',
      '.rsr-wrap.rsr-animate .rsr-balance-amt{animation:rsr-pop 0.35s ease}',
      /* Cells */
      '.rsr-cell{background:#fff;padding:13px 16px}',
      '.rsr-label{font-size:9.5px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#6b7280;margin-bottom:5px}',
      '.rsr-value{font-family:"Courier New",monospace;font-size:18px;font-weight:600;color:#1a1a1a}',
      '.rsr-sub{font-size:10px;color:#9ca3af;margin-top:3px}',
      /* Balance cell */
      '.rsr-balance{background:#1c3557!important}',
      '.rsr-balance .rsr-label{color:rgba(255,255,255,0.7)}',
      '.rsr-balance .rsr-value{color:#fff;font-size:22px}',
      '.rsr-balance .rsr-sub{color:rgba(255,255,255,0.6)}',
      '.rsr-refund{background:#14532d!important}',
      '.rsr-payable{background:#7f1d1d!important}',
      /* Joint wrapper */
      '.rsr-joint-wrap{border:2px solid #1c3557;border-radius:4px;overflow:hidden;margin:12px 0}',
      '.rsr-joint-hdr{background:#1c3557;color:#fff;padding:8px 14px;font-size:11px;font-weight:700;',
      '  letter-spacing:0.05em;text-transform:uppercase}',
      '.rsr-joint-grid{display:flex;align-items:center;background:#fff}',
      '.rsr-joint-col{flex:1;padding:12px 14px;text-align:center}',
      '.rsr-joint-total{flex:1.3}',
      '.rsr-joint-sep{font-size:22px;font-weight:300;color:#9ca3af;padding:0 6px;flex-shrink:0}',
      '.rsr-joint-name{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;',
      '  letter-spacing:0.05em;margin-bottom:4px}',
      '.rsr-joint-bal{font-family:"Courier New",monospace;font-size:17px;font-weight:700;',
      '  padding:3px 8px;border-radius:3px;display:inline-block}',
      '.rsr-joint-bal.rsr-refund{background:#dcfce7;color:#15803d}',
      '.rsr-joint-bal.rsr-payable{background:#fee2e2;color:#b91c1c}',
      '.rsr-joint-bal.rsr-large{font-size:21px}',
      '.rsr-joint-lbl{font-size:10px;color:#6b7280;margin-top:4px}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Expose ──────────────────────────────────────────────────────────────────
  global.ResultSummaryRenderer = ResultSummaryRenderer;

  console.log('ITC Phase 2.2: ResultSummaryRenderer loaded.');

})(typeof window !== 'undefined' ? window : this);
