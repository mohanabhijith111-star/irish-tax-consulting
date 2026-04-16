// ═══════════════════════════════════════════════════════════════════════════
// PDF EXPORT HANDLER — Phase 2.3
// PDFExporter class — professional proforma PDF generation and download
//
// Depends on:
//   jsPDF (loaded via CDN in index.html)
//   html2canvas (loaded via CDN in index.html)
//   proforma-builder-2025.js → PROFORMA_BUILDER  (optional)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function euro(n) {
    return '\u20ac' + Math.abs(n || 0).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * PDFExporter
   * Generates a professional Irish Tax Consulting proforma PDF.
   *
   * Usage:
   *   const ex = new PDFExporter(computationResult);
   *   ex.setClientDetails({ name, ppsn, address, taxYear, refNo });
   *   ex.downloadPDF();
   *
   * @param {Object} [computation] — result from COMPUTATION_ENGINE.calculate() (can be set later)
   */
  function PDFExporter(computation) {
    this.computation    = computation || null;
    this._clientDetails = {};
    this._filename      = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Set the computation result to export
   * @param {Object} computation
   * @returns {PDFExporter}
   */
  PDFExporter.prototype.setComputation = function(computation) {
    this.computation = computation;
    return this;
  };

  /**
   * Set client details for the PDF header
   * @param {Object} details — { name, ppsn, dob, address, taxYear, refNo, assessmentType }
   * @returns {PDFExporter}
   */
  PDFExporter.prototype.setClientDetails = function(details) {
    this._clientDetails = details || {};
    return this;
  };

  /**
   * Main export entry point (mirrors the interface described in the spec)
   * @param {Object} [computation]
   * @param {Object} [clientDetails]
   * @returns {PDFExporter}
   */
  PDFExporter.prototype.exportProformaAsPDF = function(computation, clientDetails) {
    if (computation)    this.computation    = computation;
    if (clientDetails)  this._clientDetails = clientDetails;
    return this;
  };

  /**
   * Generate and download the PDF.
   * File name format: ITC-{PPS}-{Year}-{YYYY-MM-DD}.pdf
   * @param {string} [filename]  optional override
   */
  PDFExporter.prototype.downloadPDF = function(filename) {
    var self  = this;
    var jsPDF = global.jspdf && global.jspdf.jsPDF;
    var h2c   = global.html2canvas;

    if (!jsPDF || !h2c) {
      alert(
        'PDF export unavailable — jsPDF / html2canvas libraries could not be loaded.\n\n'
        + 'This is usually caused by browser tracking prevention or an offline environment.\n'
        + 'Try:\n  1. Check your internet connection\n  2. Open in Chrome\n  3. Disable tracking prevention in browser settings'
      );
      return;
    }

    var fn = filename || this._filename || this._buildFilename();

    // ── Build full printable HTML ─────────────────────────────────────────────
    var fullHtml = this._buildPrintHTML();

    // Inject into off-screen container
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:780px;background:#fff;z-index:-1';
    wrapper.innerHTML = fullHtml;
    document.body.appendChild(wrapper);

    // ── Render with html2canvas ──────────────────────────────────────────────
    h2c(wrapper, {
      scale:    1.8,
      useCORS:  true,
      logging:  false,
      width:    780,
      windowWidth: 780,
    }).then(function(canvas) {
      document.body.removeChild(wrapper);

      var imgData = canvas.toDataURL('image/jpeg', 0.92);
      var pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pageW   = pdf.internal.pageSize.getWidth();   // 210mm
      var pageH   = pdf.internal.pageSize.getHeight();  // 297mm
      var imgW    = pageW;
      var imgH    = (canvas.height / canvas.width) * imgW;

      // Add pages for long proformas
      var yOffset = 0;
      while (yOffset < imgH) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -yOffset, imgW, imgH);
        yOffset += pageH;
      }

      // Page numbers
      var pageCount = pdf.getNumberOfPages();
      for (var i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text('Page ' + i + ' of ' + pageCount + '   |   Irish Tax Consulting — Confidential', 10, pageH - 4);
      }

      pdf.save(fn);

    }).catch(function(err) {
      if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
      console.error('PDFExporter: html2canvas failed', err);
      alert('PDF generation failed: ' + (err && err.message ? err.message : String(err)));
    });
  };

  // ── Section builders ─────────────────────────────────────────────────────────

  /**
   * Generate client header HTML
   * @param {Object} [clientDetails]
   * @param {Object} [computation]
   * @returns {string} HTML
   */
  PDFExporter.prototype.generateClientHeader = function(clientDetails, computation) {
    var cd  = clientDetails || this._clientDetails || {};
    var cmp = computation   || this.computation    || {};
    var yr  = cmp.taxYear   || cd.taxYear || new Date().getFullYear();
    var at  = cmp.assessmentType || cd.assessmentType || 'Single';
    var ft  = _formLabel(cmp);
    var today = new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });

    return [
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;',
      '            padding-bottom:16px;margin-bottom:20px;border-bottom:3px solid #1c3557">',
      '  <div>',
      '    <div style="font-size:22px;font-weight:800;color:#1c3557;font-family:Georgia,serif;letter-spacing:-0.3px">',
      '      Irish Tax Consulting',
      '    </div>',
      '    <div style="font-size:9px;color:#6b7280;margin-top:4px;letter-spacing:0.06em;text-transform:uppercase">',
      '      Chartered Tax Advisers &middot; Strictly Confidential',
      '    </div>',
      '  </div>',
      '  <div style="text-align:right;font-size:10px;color:#6b7280;line-height:1.85">',
      '    <div>' + esc(today) + '</div>',
      '    <div>File Ref: <strong style="color:#374151">' + esc(cd.refNo || '\u2014') + '</strong></div>',
      '    <div>Tax Year: <strong style="color:#374151">' + yr + '</strong></div>',
      '    <div>Form: <strong style="color:#374151">' + ft + '</strong></div>',
      '    <div>Assessment: <strong style="color:#374151">' + esc(at) + '</strong></div>',
      '  </div>',
      '</div>',
      '<div style="margin-bottom:18px;font-size:11px;line-height:1.75">',
      '  <div style="font-weight:700;font-size:12.5px;color:#111">' + esc(cd.name || '\u2014') + '</div>',
      cd.address ? '  <div style="color:#374151;margin-top:2px">' + esc(cd.address).replace(/\n/g, '<br>') + '</div>' : '',
      '  <div style="color:#6b7280;margin-top:2px">PPS: ' + esc(cd.ppsn || '\u2014') + '</div>',
      '</div>',
    ].join('\n');
  };

  /**
   * Generate the proforma table HTML
   * @param {Object} [computation]
   * @returns {string} HTML
   */
  PDFExporter.prototype.generateProformaTable = function(computation) {
    var cmp = computation || this.computation;
    if (!cmp) return '<p style="color:#6b7280">No computation data available.</p>';
    var builder = global.PROFORMA_BUILDER;
    if (builder && typeof builder.buildProformaHTML === 'function') {
      return builder.buildProformaHTML(cmp, this._clientDetails);
    }
    return '<p style="color:#6b7280">Proforma builder not available.</p>';
  };

  /**
   * Generate computation summary table
   * @param {Object} [computation]
   * @returns {string} HTML
   */
  PDFExporter.prototype.generateComputationSummary = function(computation) {
    var cmp = computation || this.computation;
    if (!cmp || !cmp.summary) return '';
    var sum      = cmp.summary;
    var balance  = sum.overallBalance || 0;
    var isRefund = balance < 0;
    var color    = isRefund ? '#15803d' : '#b91c1c';
    var bgColor  = isRefund ? '#f0fdf4' : '#fef2f2';
    var label    = isRefund ? 'REFUND DUE' : 'TAX PAYABLE';

    var paid = sum.taxPaid || {};

    return [
      '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:11px">',
      '  <thead>',
      '    <tr style="background:#1c3557;color:#fff">',
      '      <th colspan="2" style="padding:8px 12px;text-align:left;font-weight:600;letter-spacing:0.04em">',
      '        Tax Computation Summary</th>',
      '    </tr>',
      '  </thead>',
      '  <tbody>',
      _sumRow('Gross Income Tax',            euro(sum.grossIT),          '#f8f9fb'),
      _sumRow('Universal Social Charge',     euro(sum.totalUSC),         '#fff'),
      _sumRow('PRSI',                        euro(sum.totalPRSI),        '#f8f9fb'),
      sum.cgtLiability ? _sumRow('Capital Gains Tax', euro(sum.cgtLiability), '#fff') : '',
      _sumRow('Less: Non-Refundable Credits','(' + euro(sum.lessNRCredits) + ')', '#f8f9fb', '#15803d'),
      _sumRow('Less: Refundable Credits',    '(' + euro(sum.lessRefCredits) + ')', '#fff', '#15803d'),
      _sumRow('Less: Tax Already Paid',
        '(' + euro((paid.incomeTax||0) + (paid.usc||0) + (paid.prsi||0)) + ')',
        '#f8f9fb', '#15803d'),
      '    <tr style="background:' + bgColor + ';border-top:2px solid ' + color + '">',
      '      <td style="padding:10px 12px;font-weight:700;color:' + color + ';font-size:12px">' + label + '</td>',
      '      <td style="padding:10px 12px;text-align:right;font-family:\'Courier New\',monospace;',
      '              font-weight:800;font-size:14px;color:' + color + '">' + euro(Math.abs(balance)) + '</td>',
      '    </tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');
  };

  // ── Build full printable HTML ────────────────────────────────────────────────

  PDFExporter.prototype._buildPrintHTML = function() {
    var header   = this.generateClientHeader();
    var summary  = this.generateComputationSummary();
    var proforma = this.generateProformaTable();
    var today    = new Date().toLocaleDateString('en-IE');
    var yr       = (this.computation && this.computation.taxYear) || new Date().getFullYear();

    return [
      '<div style="font-family:\'Inter\',Arial,sans-serif;font-size:11.5px;color:#1a1a1a;',
      '            width:740px;padding:40px 50px;background:#fff;box-sizing:border-box;',
      '            line-height:1.6">',

      '  <!-- CONFIDENTIAL WATERMARK (diagonal) -->',
      '  <div style="position:fixed;top:45%;left:20%;font-size:72px;font-weight:900;',
      '              color:rgba(0,0,0,0.04);transform:rotate(-35deg);',
      '              letter-spacing:4px;pointer-events:none;z-index:0;',
      '              font-family:Georgia,serif;text-transform:uppercase">',
      '    CONFIDENTIAL',
      '  </div>',

      '  <div style="position:relative;z-index:1">',

      header,
      summary,
      proforma,

      '    <!-- Disclaimer footer -->',
      '    <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;',
      '                font-size:9px;color:#9ca3af;line-height:1.65">',
      '      <strong>DISCLAIMER:</strong> This computation has been prepared solely on the basis of information',
      '      provided by the client and is for internal advisory purposes only. All figures must be verified',
      '      against Revenue records before filing. Irish Tax Consulting accepts no liability for errors',
      '      arising from incomplete or inaccurate information. This document is confidential.',
      '      <br>Generated: ' + today + ' &nbsp;&middot;&nbsp; Tax Year ' + yr + ' &nbsp;&middot;&nbsp; Irish Tax Consulting Internal System v3.0',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');
  };

  // ── Filename ─────────────────────────────────────────────────────────────────

  PDFExporter.prototype._buildFilename = function() {
    var cd   = this._clientDetails || {};
    var pps  = (cd.ppsn || 'NOPPS').replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'NOPPS';
    var yr   = (this.computation && this.computation.taxYear) || cd.taxYear || new Date().getFullYear();
    var today = new Date().toISOString().slice(0, 10);
    return 'ITC-' + pps + '-' + yr + '-' + today + '.pdf';
  };

  // ── Static helpers ────────────────────────────────────────────────────────────

  function _sumRow(label, value, bg, color) {
    return [
      '<tr style="background:' + (bg || '#fff') + '">',
      '  <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#374151">' + esc(label) + '</td>',
      '  <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;',
      '      font-family:\'Courier New\',monospace;font-weight:600;color:' + (color || '#1a1a1a') + '">' + value + '</td>',
      '</tr>',
    ].join('');
  }

  function _formLabel(cmp) {
    if (!cmp) return 'Form 11';
    var at = (cmp.assessmentType || '').toLowerCase();
    if (at === 'single' || at === '') {
      return 'Form 11 \u2014 Self-Assessment (ROS)';
    }
    if (at === 'married' || at === 'joint') {
      return 'Form 11 \u2014 Joint Assessment (ROS)';
    }
    return 'Form 11 \u2014 Self-Assessment (ROS)';
  }

  // ── Expose ──────────────────────────────────────────────────────────────────
  global.PDFExporter = PDFExporter;

  console.log('ITC Phase 2.3: PDFExporter loaded.');

})(typeof window !== 'undefined' ? window : this);
