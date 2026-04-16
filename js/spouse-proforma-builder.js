// ═══════════════════════════════════════════════════════════════════════════
// SPOUSE PROFORMA BUILDER — Phase 2.4
// Extends PROFORMA_BUILDER with side-by-side spouse proforma support
//
// Depends on:
//   proforma-builder-2025.js → PROFORMA_BUILDER  (extended in place)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function euro(n) {
    return '\u20ac' + Math.abs(n || 0).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Core function ────────────────────────────────────────────────────────────

  /**
   * buildSpouseProformaHTML
   *
   * Generates a side-by-side HTML layout with:
   *   - Spouse 1 (navy header) column
   *   - Spouse 2 (purple header) column
   *   - Joint note bar spanning both columns
   *   - Combined balance row at the bottom
   *
   * @param {Object} spouse1Computation — result from COMPUTATION_ENGINE.calculate()
   * @param {Object} spouse2Computation — result from COMPUTATION_ENGINE.calculate()
   * @param {Object} [clientDetails]    — { spouse1Name, spouse2Name, taxYear, refNo, ... }
   * @returns {string} HTML
   */
  function buildSpouseProformaHTML(spouse1Computation, spouse2Computation, clientDetails) {
    var cd = clientDetails || {};
    var yr = (spouse1Computation && spouse1Computation.taxYear) || cd.taxYear || 2025;

    var s1Name = esc(cd.spouse1Name || 'Spouse 1');
    var s2Name = esc(cd.spouse2Name || 'Spouse 2');

    // Per-spouse balance
    var b1 = (spouse1Computation && spouse1Computation.summary && spouse1Computation.summary.overallBalance) || 0;
    var b2 = (spouse2Computation && spouse2Computation.summary && spouse2Computation.summary.overallBalance) || 0;
    var combined = Math.round((b1 + b2) * 100) / 100;
    var isRefund = combined < 0;

    // Per-spouse proformas from PROFORMA_BUILDER
    // Use 'displayName' to avoid shadowing any existing 'name' property in client details
    var builder = global.PROFORMA_BUILDER;
    var s1Cd = Object.assign({}, cd, { displayName: cd.spouse1Name || 'Spouse 1', name: cd.spouse1Name || cd.name || 'Spouse 1' });
    var s2Cd = Object.assign({}, cd, { displayName: cd.spouse2Name || 'Spouse 2', name: cd.spouse2Name || 'Spouse 2' });
    var s1Html = builder && typeof builder.buildProformaHTML === 'function'
      ? builder.buildProformaHTML(spouse1Computation, s1Cd)
      : _fallbackTable(spouse1Computation, 'Spouse 1');
    var s2Html = builder && typeof builder.buildProformaHTML === 'function'
      ? builder.buildProformaHTML(spouse2Computation, s2Cd)
      : _fallbackTable(spouse2Computation, 'Spouse 2');

    // Badge CSS classes for balance
    var b1Cls = b1 < 0 ? 'spb-ref' : 'spb-pay';
    var b2Cls = b2 < 0 ? 'spb-ref' : 'spb-pay';
    var combCls = isRefund ? 'spb-ref' : 'spb-pay';

    _ensureCSS();

    return [
      '<div class="spb-wrap" role="region" aria-label="Joint assessment proforma">',

      '  <!-- Title bar -->',
      '  <div class="spb-title">',
      '    <span>\u2694\ufe0f Joint Assessment &mdash; Tax Year ' + yr + '</span>',
      '    <span class="spb-badge ' + combCls + '">' +
        'Combined ' + (isRefund ? 'Refund' : 'Payable') + ': ' + euro(Math.abs(combined)) +
      '</span>',
      '  </div>',

      '  <!-- Two-column layout -->',
      '  <div class="spb-cols">',

      '    <!-- Spouse 1 column (navy) -->',
      '    <div class="spb-col spb-col-s1">',
      '      <div class="spb-col-hdr spb-hdr-s1">',
      '        <span>' + s1Name + '</span>',
      '        <span class="spb-badge ' + b1Cls + '">' +
          (b1 < 0 ? 'Refund: ' : 'Payable: ') + euro(Math.abs(b1)) +
        '</span>',
      '      </div>',
      '      <div class="spb-col-body">' + s1Html + '</div>',
      '    </div>',

      '    <!-- Spouse 2 column (purple) -->',
      '    <div class="spb-col spb-col-s2">',
      '      <div class="spb-col-hdr spb-hdr-s2">',
      '        <span>' + s2Name + '</span>',
      '        <span class="spb-badge ' + b2Cls + '">' +
          (b2 < 0 ? 'Refund: ' : 'Payable: ') + euro(Math.abs(b2)) +
        '</span>',
      '      </div>',
      '      <div class="spb-col-body">' + s2Html + '</div>',
      '    </div>',

      '  </div>',

      '  <!-- Joint note bar -->',
      '  <div class="spb-joint-note">',
      '    <strong>Joint Assessment Note:</strong>',
      '    Tax Year ' + yr + ' &mdash;',
      '    ' + s1Name + ': ' + (b1 < 0 ? '<span class="spb-note-ref">Refund ' : '<span class="spb-note-pay">Payable ') + euro(Math.abs(b1)) + '</span>',
      '    &nbsp;&nbsp;+&nbsp;&nbsp;',
      '    ' + s2Name + ': ' + (b2 < 0 ? '<span class="spb-note-ref">Refund ' : '<span class="spb-note-pay">Payable ') + euro(Math.abs(b2)) + '</span>',
      '    &nbsp;&nbsp;=&nbsp;&nbsp;',
      '    <strong>Combined ' + (isRefund ? 'Refund' : 'Tax Payable') + ': <span class="' + (isRefund ? 'spb-note-ref' : 'spb-note-pay') + '">' + euro(Math.abs(combined)) + '</span></strong>',
      '  </div>',

      '  <!-- Combined balance bar -->',
      '  <div class="spb-combined-bar ' + (isRefund ? 'spb-combined-ref' : 'spb-combined-pay') + '">',
      '    <div class="spb-combined-lbl">' + (isRefund ? 'TOTAL REFUND DUE' : 'TOTAL TAX PAYABLE') + '</div>',
      '    <div class="spb-combined-amt">' + euro(Math.abs(combined)) + '</div>',
      '    <div class="spb-combined-sub">Tax Year ' + yr + ' &mdash; Joint Assessment</div>',
      '  </div>',

      '</div>',
    ].join('\n');
  }

  // ── Fallback proforma table (when PROFORMA_BUILDER is not available) ─────────

  function _fallbackTable(computation, label) {
    if (!computation || !computation.summary) {
      return '<p style="color:#6b7280;padding:12px">No computation data for ' + esc(label) + '.</p>';
    }
    var sum = computation.summary;
    var bal = sum.overallBalance || 0;
    var isRef = bal < 0;

    var rows = [
      ['Gross Income Tax',      euro(sum.grossIT)],
      ['USC',                   euro(sum.totalUSC)],
      ['PRSI',                  euro(sum.totalPRSI)],
      ['Less NR Credits',       '(' + euro(sum.lessNRCredits) + ')'],
      ['Less Refundable Credits','(' + euro(sum.lessRefCredits) + ')'],
    ];

    return [
      '<table style="width:100%;border-collapse:collapse;font-size:11.5px">',
      rows.map(function(r) {
        return '<tr><td style="padding:5px 10px;border-bottom:1px solid #e5e7eb">' + r[0] + '</td>'
          + '<td style="text-align:right;padding:5px 10px;border-bottom:1px solid #e5e7eb;font-family:\'Courier New\',monospace">' + r[1] + '</td></tr>';
      }).join(''),
      '<tr style="background:' + (isRef ? '#f0fdf4' : '#fef2f2') + ';border-top:2px solid ' + (isRef ? '#16a34a' : '#dc2626') + '">',
      '  <td style="padding:7px 10px;font-weight:700;color:' + (isRef ? '#15803d' : '#b91c1c') + '">' + (isRef ? 'Refund Due' : 'Tax Payable') + '</td>',
      '  <td style="text-align:right;padding:7px 10px;font-family:\'Courier New\',monospace;font-weight:800;color:' + (isRef ? '#15803d' : '#b91c1c') + '">' + euro(Math.abs(bal)) + '</td>',
      '</tr>',
      '</table>',
    ].join('');
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  function _ensureCSS() {
    if (document.getElementById('spb-css')) return;
    var style = document.createElement('style');
    style.id = 'spb-css';
    style.textContent = [
      /* Wrapper */
      '.spb-wrap{font-family:"Inter",sans-serif;font-size:12.5px;border:1px solid #c8cdd6;border-radius:4px;overflow:hidden;margin-bottom:16px}',
      /* Title bar */
      '.spb-title{background:#1c3557;color:#fff;padding:10px 16px;font-size:11.5px;font-weight:700;',
      '  letter-spacing:0.04em;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center}',
      /* Two-column grid */
      '.spb-cols{display:grid;grid-template-columns:1fr 1fr;gap:0}',
      '@media(max-width:860px){.spb-cols{grid-template-columns:1fr}}',
      /* Column */
      '.spb-col{overflow:hidden}',
      '.spb-col-s1{border-right:2px solid #1c3557}',
      '@media(max-width:860px){.spb-col-s1{border-right:none;border-bottom:2px solid #1c3557}}',
      /* Column headers */
      '.spb-col-hdr{padding:8px 14px;font-size:11px;font-weight:700;letter-spacing:0.05em;',
      '  text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid}',
      '.spb-hdr-s1{background:#1c3557;color:#fff;border-color:#1c3557}',
      '.spb-hdr-s2{background:#3b1f6e;color:#fff;border-color:#3b1f6e}',
      '.spb-col-body{background:#fff}',
      /* Badges */
      '.spb-badge{font-family:"Courier New",monospace;font-size:11px;padding:2px 8px;border-radius:3px;font-weight:700}',
      '.spb-ref{background:#16a34a;color:#fff}',
      '.spb-pay{background:#dc2626;color:#fff}',
      /* Joint note */
      '.spb-joint-note{background:#f0f5ff;border-top:1px solid #c7d7f0;border-bottom:1px solid #c7d7f0;',
      '  padding:7px 16px;font-size:11px;color:#1e3a8a;line-height:1.6}',
      '.spb-note-ref{color:#15803d;font-weight:700}',
      '.spb-note-pay{color:#b91c1c;font-weight:700}',
      /* Combined balance bar */
      '.spb-combined-bar{display:flex;align-items:center;gap:16px;padding:12px 18px;flex-wrap:wrap}',
      '.spb-combined-ref{background:#f0fdf4;border-top:3px solid #16a34a}',
      '.spb-combined-pay{background:#fef2f2;border-top:3px solid #dc2626}',
      '.spb-combined-lbl{font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;flex-shrink:0}',
      '.spb-combined-ref .spb-combined-lbl{color:#15803d}',
      '.spb-combined-pay .spb-combined-lbl{color:#b91c1c}',
      '.spb-combined-amt{font-family:"Courier New",monospace;font-size:22px;font-weight:800;flex-shrink:0}',
      '.spb-combined-ref .spb-combined-amt{color:#15803d}',
      '.spb-combined-pay .spb-combined-amt{color:#b91c1c}',
      '.spb-combined-sub{font-size:10px;color:#9ca3af;margin-left:auto}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Extend PROFORMA_BUILDER ──────────────────────────────────────────────────

  function _extend() {
    var pb = global.PROFORMA_BUILDER;
    if (pb && !pb.buildSpouseProformaHTML) {
      pb.buildSpouseProformaHTML = buildSpouseProformaHTML;
    }
  }

  // Try immediately; if PROFORMA_BUILDER isn't loaded yet, defer to DOMContentLoaded
  if (global.PROFORMA_BUILDER) {
    _extend();
  } else {
    document.addEventListener('DOMContentLoaded', _extend);
  }

  // ── Expose as standalone ─────────────────────────────────────────────────────
  global.SpouseProformaBuilder = {
    buildSpouseProformaHTML: buildSpouseProformaHTML,
  };

  console.log('ITC Phase 2.4: SpouseProformaBuilder loaded.');

})(typeof window !== 'undefined' ? window : this);
