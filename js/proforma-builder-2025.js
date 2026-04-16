// ═══════════════════════════════════════════════════════════════════════════
// PROFORMA BUILDER 2025 — HTML Proforma Generator
// Depends on: computation-engine-2025.js (COMPUTATION_ENGINE must be loaded first)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ─── Formatting helpers ───────────────────────────────────────────────────
  function euro(n) {
    if (typeof n !== 'number' || isNaN(n)) n = 0;
    return '€' + Math.abs(n).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pct(n) {
    return (typeof n === 'number' ? (n * 100).toFixed(1) : '0.0') + '%';
  }

  function sign(n) {
    return n < 0 ? 'REFUND' : (n === 0 ? 'NIL' : 'PAYABLE');
  }

  // ─── Row builder helpers ───────────────────────────────────────────────────
  function row(label, amount, cls, indent) {
    var indentStyle = indent ? 'padding-left:' + (indent * 16) + 'px;' : '';
    var amtClass = cls || '';
    return '<tr><td style="' + indentStyle + '">' + label + '</td><td class="' + amtClass + '">' + amount + '</td></tr>';
  }

  function totalRow(label, amount, cls) {
    return '<tr class="pf-total"><td>' + label + '</td><td class="' + (cls || '') + '">' + amount + '</td></tr>';
  }

  function sectionHdr(title) {
    return '<tr class="pf-section-hdr"><td colspan="2">' + title + '</td></tr>';
  }

  function spacerRow() {
    return '<tr class="pf-spacer"><td colspan="2"></td></tr>';
  }

  function nilRow(label, indent) {
    return row(label, '<span class="pf-nil">—</span>', 'pf-right', indent);
  }

  // ─── CSS (injected once) ──────────────────────────────────────────────────
  var CSS_ID = 'proforma-builder-css';

  function ensureCSS() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = [
      '.pf-wrap { font-family: "IBM Plex Mono", "Courier New", monospace; font-size: 12px; color: #1a1916; background: #fff; border: 1px solid #d0ccc4; border-radius: 4px; overflow: hidden; }',
      '.pf-header { background: #1c3557; color: #fff; padding: 12px 16px; }',
      '.pf-header h2 { margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; }',
      '.pf-header .pf-sub { font-size: 11px; color: #a8bcd4; margin-top: 2px; }',
      '.pf-client { padding: 8px 16px; background: #f8f7f5; border-bottom: 1px solid #e5e2dc; font-size: 11px; color: #4a4640; }',
      '.pf-client span { font-weight: 600; color: #1a1916; }',
      '.pf-table { width: 100%; border-collapse: collapse; }',
      '.pf-table td { padding: 4px 12px; border-bottom: 1px solid #f0ede8; vertical-align: top; }',
      '.pf-table td:last-child { text-align: right; white-space: nowrap; min-width: 110px; }',
      '.pf-section-hdr td { background: #e8edf4; color: #1c3557; font-weight: 700; font-size: 11px; padding: 6px 12px; text-transform: uppercase; letter-spacing: 0.6px; }',
      '.pf-total td { font-weight: 700; background: #f8f7f5; border-top: 2px solid #d0ccc4; border-bottom: 2px solid #d0ccc4; }',
      '.pf-spacer td { height: 6px; background: #faf9f7; }',
      '.pf-nil { color: #aaa; }',
      '.pf-right { text-align: right; }',
      '.pf-neg { color: #8b1f1f; }',
      '.pf-pos { color: #1a4d2e; }',
      '.pf-zero { color: #777; }',
      '.pf-warn { background: #fffaed; }',
      '.pf-warn td { color: #7a5500; font-size: 10px; }',
      '.pf-balance-box { display: flex; border: 1px solid #d0ccc4; border-radius: 4px; overflow: hidden; margin-top: 8px; }',
      '.pf-balance-cell { flex: 1; text-align: center; padding: 10px 8px; border-right: 1px solid #d0ccc4; }',
      '.pf-balance-cell:last-child { border-right: none; }',
      '.pf-balance-cell .pf-bc-label { font-size: 10px; color: #7a756e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }',
      '.pf-balance-cell .pf-bc-value { font-size: 16px; font-weight: 700; color: #1a1916; font-family: "IBM Plex Mono", monospace; }',
      '.pf-balance-cell.pf-bc-refund .pf-bc-value { color: #1a4d2e; }',
      '.pf-balance-cell.pf-bc-payable .pf-bc-value { color: #8b1f1f; }',
      '.pf-balance-cell .pf-bc-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 10px; margin-top: 3px; }',
      '.pf-badge-refund { background: #f0f7f2; color: #1a4d2e; border: 1px solid #a8d4b8; }',
      '.pf-badge-payable { background: #fdf0f0; color: #8b1f1f; border: 1px solid #e8b4b4; }',
      '.pf-badge-nil { background: #f4f3f0; color: #7a756e; border: 1px solid #d0ccc4; }',
      '.pf-warnings { padding: 8px 12px; background: #fffaed; border-top: 1px solid #f0c060; }',
      '.pf-warnings ul { margin: 0; padding-left: 16px; }',
      '.pf-warnings li { font-size: 10px; color: #7a5500; margin-bottom: 2px; }',
      '.pf-footer { padding: 6px 12px; background: #f4f3f0; border-top: 1px solid #e5e2dc; font-size: 10px; color: #aaa; text-align: right; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // buildProformaHTML(computation, clientDetails)
  //
  // computation   — result from COMPUTATION_ENGINE.calculate()
  // clientDetails — { name, ppsn, taxYear, assessmentType, refNo } (optional)
  // ═══════════════════════════════════════════════════════════════════════════
  function buildProformaHTML(computation, clientDetails) {
    if (!computation || !computation.summary) {
      return '<div class="pf-wrap" style="padding:16px;color:#8b1f1f">No computation result provided.</div>';
    }

    ensureCSS();

    var cd   = clientDetails || {};
    var inc  = computation.income;
    var rel  = computation.reliefs;
    var it   = computation.incomeTax;
    var usc  = computation.usc;
    var prsi = computation.prsi;
    var cgt  = computation.cgt;
    var dirt = computation.dirt;
    var dwt  = computation.dwt;
    var crd  = computation.credits;
    var sum  = computation.summary;
    var yr   = computation.taxYear || 2025;
    var asmType = computation.assessmentType || 'Single';

    var rows = [];

    // ── Header ───────────────────────────────────────────────────────────
    var clientHtml = '';
    if (cd.name || cd.ppsn || cd.refNo) {
      var parts = [];
      if (cd.name)  parts.push('<span>' + escHtml(cd.name) + '</span>');
      if (cd.ppsn)  parts.push('PPS: <span>' + escHtml(cd.ppsn) + '</span>');
      if (cd.refNo) parts.push('Ref: <span>' + escHtml(cd.refNo) + '</span>');
      clientHtml = '<div class="pf-client">' + parts.join(' &nbsp;|&nbsp; ') + '</div>';
    }

    var headerHtml = [
      '<div class="pf-header">',
      '  <h2>Income Tax Computation — Tax Year ' + yr + '</h2>',
      '  <div class="pf-sub">Assessment: ' + asmType + ' &nbsp;|&nbsp; Form: ' + _detectForm(computation) + '</div>',
      '</div>',
      clientHtml,
    ].join('');

    // ── Section A: Income ─────────────────────────────────────────────────
    rows.push(sectionHdr('A — Income'));
    if (inc.employment > 0) rows.push(row('Employment Income', euro(inc.employment), 'pf-right', 1));
    if (inc.bik > 0)        rows.push(row('Benefit-in-Kind', euro(inc.bik), 'pf-right', 1));
    if (inc.dsp > 0)        rows.push(row('State Pension / DSP', euro(inc.dsp), 'pf-right', 1));
    if (inc.trade > 0)      rows.push(row('Trade / Profession (net)', euro(inc.trade), 'pf-right', 1));
    if (inc.directors > 0)  rows.push(row('Director\'s Fees', euro(inc.directors), 'pf-right', 1));
    if (inc.rental > 0)     rows.push(row('Rental Income (net)', euro(inc.rental), 'pf-right', 1));
    if (inc.dividends > 0)  rows.push(row('Irish Dividends', euro(inc.dividends), 'pf-right', 1));
    if (inc.foreignIncome > 0) rows.push(row('Foreign Income', euro(inc.foreignIncome), 'pf-right', 1));
    if (inc.other > 0)      rows.push(row('Other Income', euro(inc.other), 'pf-right', 1));

    var allZero = (inc.grossIncome === 0);
    if (allZero) rows.push(nilRow('No income sources entered', 1));

    rows.push(totalRow('Gross Income', euro(inc.grossIncome)));
    rows.push(spacerRow());

    // ── Section B: Pre-IT Deductions ──────────────────────────────────────
    rows.push(sectionHdr('B — Deductions &amp; Reliefs'));
    var hasDeductions = rel.totalPreDeductions > 0;
    if (rel.pensionAllowed > 0)    rows.push(row('Pension Contributions', '(' + euro(rel.pensionAllowed) + ')', 'pf-neg pf-right', 1));
    if (rel.capitalAllowances > 0) rows.push(row('Capital Allowances', '(' + euro(rel.capitalAllowances) + ')', 'pf-neg pf-right', 1));
    if (rel.rentalExpenses > 0)    rows.push(row('Rental Expenses', '(' + euro(rel.rentalExpenses) + ')', 'pf-neg pf-right', 1));
    if (rel.flatRateExpenses > 0)  rows.push(row('Flat Rate Expenses', '(' + euro(rel.flatRateExpenses) + ')', 'pf-neg pf-right', 1));
    if (rel.wfhExpenses > 0)       rows.push(row('Work From Home Expenses', '(' + euro(rel.wfhExpenses) + ')', 'pf-neg pf-right', 1));
    if (rel.tradeLosses > 0)       rows.push(row('Trade Losses', '(' + euro(rel.tradeLosses) + ')', 'pf-neg pf-right', 1));
    if (rel.otherDeductions > 0)   rows.push(row('Other Deductions', '(' + euro(rel.otherDeductions) + ')', 'pf-neg pf-right', 1));
    if (!hasDeductions) rows.push(nilRow('No deductions entered', 1));

    rows.push(totalRow('Total Deductions', '(' + euro(rel.totalPreDeductions) + ')', 'pf-neg'));

    // Pension excess warning
    if (rel.pensionExcess > 0) {
      rows.push('<tr class="pf-warn"><td colspan="2" style="padding:4px 12px 4px 24px;font-size:10px;">⚠ Pension excess of ' + euro(rel.pensionExcess) + ' not allowed (age-band cap)</td></tr>');
    }
    rows.push(spacerRow());

    // ── Section C: Taxable Income ──────────────────────────────────────────
    rows.push(sectionHdr('C — Taxable Income'));
    rows.push(totalRow('Gross Income', euro(inc.grossIncome)));
    rows.push(row('Less: Total Deductions', '(' + euro(rel.totalPreDeductions) + ')', 'pf-neg pf-right'));
    rows.push(totalRow('Taxable Income', euro(computation.taxableIncome)));
    rows.push(spacerRow());

    // ── Section D: Income Tax ──────────────────────────────────────────────
    rows.push(sectionHdr('D — Income Tax'));
    rows.push(row('Standard Rate Band (' + pct(0.20) + ' × ' + euro(it.standardRateBand) + ')', euro(it.standardRateTax), 'pf-right', 1));
    if (it.higherRateBand > 0) {
      rows.push(row('Higher Rate Band (' + pct(0.40) + ' × ' + euro(it.higherRateBand) + ')', euro(it.higherRateTax), 'pf-right', 1));
    } else {
      rows.push(row('Higher Rate Band (income within 40% standard rate band: ' + euro(it.cutOff) + ')', '<span class="pf-nil">—</span>', 'pf-right', 1));
    }
    rows.push(totalRow('Gross Income Tax', euro(it.grossIT)));
    rows.push(spacerRow());

    // ── Section E: Tax Credits ────────────────────────────────────────────
    rows.push(sectionHdr('E — Tax Credits'));
    if (crd && crd.list && crd.list.length > 0) {
      crd.list.forEach(function(c) {
        if (c.refundable) return; // refundable credits shown separately
        var capBadge = c.capped
          ? ' <span style="font-size:9px;background:#fff3cd;color:#7a4f00;border:1px solid #f0c060;border-radius:3px;padding:1px 5px;font-weight:700">CAPPED</span>'
          : '';
        rows.push(row(c.label + capBadge, '(' + euro(c.appliedAmount) + ')', 'pf-neg pf-right', 1));
      });

      if (crd.unusedNR > 0) {
        rows.push('<tr class="pf-warn"><td colspan="2" style="padding:4px 12px 4px 24px;font-size:10px;">⚠ Unused credits ' + euro(crd.unusedNR) + ' forfeited — income too low to utilise in full</td></tr>');
      }
    } else {
      rows.push(nilRow('No credits entered', 1));
    }
    rows.push(totalRow('Total Non-Refundable Credits', '(' + euro(crd ? crd.totalNRApplied : 0) + ')', 'pf-neg'));
    rows.push(totalRow('Net Income Tax (after credits)', euro(computation.netIT)));
    rows.push(spacerRow());

    // Refundable credits
    if (crd && crd.refundableCredits && crd.refundableCredits.length > 0) {
      rows.push(sectionHdr('E2 — Refundable Credits'));
      crd.refundableCredits.forEach(function(c) {
        rows.push(row(c.label, '(' + euro(c.amount) + ')', 'pf-neg pf-right', 1));
      });
      rows.push(totalRow('Net IT After Refundable Credits', euro(computation.netITAfterRefundable)));
      rows.push(spacerRow());
    }

    // ── Section F: Medical Expenses & Tuition ────────────────────────────
    if (rel.medRelief > 0 || rel.tuitionRelief > 0) {
      rows.push(sectionHdr('F — Additional Reliefs'));
      if (rel.medRelief > 0) {
        rows.push(row('Health Expenses (gross: ' + euro(rel.medGross) + ', net: ' + euro(rel.medNet) + ')', '(' + euro(rel.medRelief) + ')', 'pf-neg pf-right', 1));
      }
      if (rel.tuitionRelief > 0) {
        rows.push(row('Tuition Fees (gross: ' + euro(rel.tuitionGross) + ', after disregard: ' + euro(rel.tuitionNet) + ')', '(' + euro(rel.tuitionRelief) + ')', 'pf-neg pf-right', 1));
      }
      rows.push(spacerRow());
    }

    // ── Section G: USC ────────────────────────────────────────────────────
    rows.push(sectionHdr('G — Universal Social Charge (USC)'));
    if (usc.exempt) {
      rows.push(row('USC exempt — income ≤ €13,000', '<span class="pf-nil">—</span>', 'pf-right', 1));
    } else {
      usc.bands.forEach(function(b) {
        rows.push(row(b.label + ' on ' + euro(b.income), euro(b.charge), 'pf-right', 1));
      });
    }
    rows.push(totalRow('Total USC', euro(usc.total)));
    rows.push(spacerRow());

    // ── Section H: PRSI ───────────────────────────────────────────────────
    rows.push(sectionHdr('H — Pay Related Social Insurance (PRSI)'));
    if (prsi.note) {
      rows.push(row(prsi.note, '<span class="pf-nil">—</span>', 'pf-right', 1));
    }
    if (prsi.breakdown && prsi.breakdown.length > 0) {
      prsi.breakdown.forEach(function(b) {
        if (b.charge > 0) {
          rows.push(row(b.label, euro(b.charge), 'pf-right', 1));
        } else {
          rows.push(row(b.label + (b.note ? ' — ' + b.note : ''), '<span class="pf-nil">—</span>', 'pf-right', 1));
        }
      });
    } else if (!prsi.note) {
      rows.push(nilRow('No PRSI liability', 1));
    }
    rows.push(totalRow('Total PRSI', euro(prsi.total)));
    rows.push(spacerRow());

    // ── Section I: DIRT ───────────────────────────────────────────────────
    if (dirt.income > 0) {
      rows.push(sectionHdr('I — Deposit Interest Retention Tax (DIRT)'));
      rows.push(row('Deposit Interest', euro(dirt.income), 'pf-right', 1));
      rows.push(row('DIRT @ ' + pct(dirt.rate), euro(dirt.charge), 'pf-right', 1));
      rows.push(row('DIRT deducted at source', '(' + euro(dirt.alreadyPaid) + ')', 'pf-neg pf-right', 1));
      rows.push(totalRow('Net DIRT Liability', euro(0), 'pf-zero'));
      rows.push(spacerRow());
    }

    // ── Section J: CGT ────────────────────────────────────────────────────
    if (cgt.gain > 0) {
      rows.push(sectionHdr('J — Capital Gains Tax (CGT)'));
      rows.push(row('Capital Gain', euro(cgt.gain), 'pf-right', 1));
      rows.push(row('Less: Annual Exemption', '(' + euro(cgt.annualExemption) + ')', 'pf-neg pf-right', 1));
      rows.push(row('Taxable Gain', euro(cgt.taxableGain), 'pf-right', 1));
      rows.push(row('CGT @ ' + pct(0.33), euro(cgt.liability), 'pf-right', 1));
      rows.push(totalRow('CGT Liability', euro(cgt.liability)));
      rows.push(spacerRow());
    }

    // ── Section K: Summary / Net Balance ─────────────────────────────────
    rows.push(sectionHdr('K — Net Liability / Refund'));
    rows.push(row('Income Tax (after all credits)', euro(computation.netITAfterRefundable), 'pf-right'));
    rows.push(row('Universal Social Charge', euro(usc.total), 'pf-right'));
    rows.push(row('PRSI', euro(prsi.total), 'pf-right'));
    if (cgt.gain > 0) rows.push(row('Capital Gains Tax', euro(cgt.liability), 'pf-right'));
    rows.push(spacerRow());

    if (sum.taxPaid.incomeTax > 0 || sum.taxPaid.usc > 0 || sum.taxPaid.prsi > 0) {
      rows.push(row('Less: Income Tax Paid', '(' + euro(sum.taxPaid.incomeTax) + ')', 'pf-neg pf-right'));
      rows.push(row('Less: USC Paid', '(' + euro(sum.taxPaid.usc) + ')', 'pf-neg pf-right'));
      rows.push(row('Less: PRSI Paid', '(' + euro(sum.taxPaid.prsi) + ')', 'pf-neg pf-right'));
      if (sum.taxPaid.cgt > 0) rows.push(row('Less: CGT Paid', '(' + euro(sum.taxPaid.cgt) + ')', 'pf-neg pf-right'));
      rows.push(spacerRow());
    }

    var balanceClass = sum.overallBalance < 0 ? 'pf-pos' : (sum.overallBalance > 0 ? 'pf-neg' : 'pf-zero');
    var balanceLabel = sum.overallBalance < 0 ? '✓ REFUND DUE' : (sum.overallBalance > 0 ? '⬆ TAX PAYABLE' : '◎ BALANCE NIL');
    rows.push('<tr class="pf-total" style="font-size:13px"><td>' + balanceLabel + '</td><td class="' + balanceClass + '">' + euro(Math.abs(sum.overallBalance)) + '</td></tr>');

    // ── Warnings ──────────────────────────────────────────────────────────
    var warningsHtml = '';
    if (computation.warnings && computation.warnings.length > 0) {
      warningsHtml = [
        '<div class="pf-warnings">',
        '  <strong style="font-size:10px;color:#7a5500">⚠ Computation Notes:</strong>',
        '  <ul>',
        computation.warnings.map(function(w) { return '    <li>' + escHtml(w.message) + '</li>'; }).join('\n'),
        '  </ul>',
        '</div>',
      ].join('\n');
    }

    var footerHtml = '<div class="pf-footer">Computed: ' + new Date().toLocaleDateString('en-IE') + ' &nbsp;|&nbsp; Tax Year ' + yr + ' &nbsp;|&nbsp; Rates source: Revenue.ie</div>';

    return [
      '<div class="pf-wrap">',
      headerHtml,
      '<table class="pf-table"><tbody>',
      rows.join('\n'),
      '</tbody></table>',
      warningsHtml,
      footerHtml,
      '</div>',
    ].join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // buildResultSummary(computation)
  // Generates a compact 3-cell summary box.
  // ═══════════════════════════════════════════════════════════════════════════
  function buildResultSummary(computation) {
    if (!computation || !computation.summary) {
      return '<div class="pf-balance-box" style="padding:12px;color:#8b1f1f">No computation result.</div>';
    }

    ensureCSS();

    var sum  = computation.summary;
    var it   = computation.incomeTax;
    var usc  = computation.usc;
    var prsi = computation.prsi;

    // Cell 1: Total Tax (IT + USC + PRSI)
    var totalTax = (it ? it.grossIT : 0) + (usc ? usc.total : 0) + (prsi ? prsi.total : 0);

    // Cell 2: Less Credits
    var lessCredits = computation.credits ? computation.credits.totalNRApplied + computation.credits.totalRefundable : 0;

    // Cell 3: Net Balance
    var balance     = sum.overallBalance;
    var isRefund    = balance < 0;
    var isNil       = balance === 0;
    var balClass    = isRefund ? 'pf-bc-refund' : (isNil ? '' : 'pf-bc-payable');
    var badgeClass  = isRefund ? 'pf-badge-refund' : (isNil ? 'pf-badge-nil' : 'pf-badge-payable');
    var badgeLabel  = isRefund ? 'REFUND' : (isNil ? 'NIL' : 'PAYABLE');

    return [
      '<div class="pf-balance-box">',
      '  <div class="pf-balance-cell">',
      '    <div class="pf-bc-label">Total Tax &amp; Charges</div>',
      '    <div class="pf-bc-value">' + euro(totalTax) + '</div>',
      '    <div style="font-size:10px;color:#7a756e">IT + USC + PRSI</div>',
      '  </div>',
      '  <div class="pf-balance-cell">',
      '    <div class="pf-bc-label">Less Credits Applied</div>',
      '    <div class="pf-bc-value" style="color:#8b1f1f">(' + euro(lessCredits) + ')</div>',
      '    <div style="font-size:10px;color:#7a756e">Non-refundable + refundable</div>',
      '  </div>',
      '  <div class="pf-balance-cell ' + balClass + '">',
      '    <div class="pf-bc-label">Net Balance</div>',
      '    <div class="pf-bc-value">' + euro(Math.abs(balance)) + '</div>',
      '    <span class="pf-bc-badge ' + badgeClass + '">' + badgeLabel + '</span>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────
  function _detectForm(computation) {
    if (!computation || !computation.income) return 'Form 12';
    var inc = computation.income;
    if (inc.trade > 0 || inc.directors > 0 || inc.foreignIncome > 0 || inc.rental > 5000) return 'Form 11';
    return 'Form 12';
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  var PROFORMA_BUILDER = {
    buildProformaHTML: buildProformaHTML,
    buildResultSummary: buildResultSummary,
    // Expose helpers for custom use
    euro: euro,
    pct: pct,
    sign: sign,
  };

  global.PROFORMA_BUILDER = PROFORMA_BUILDER;

})(typeof window !== 'undefined' ? window : this);
