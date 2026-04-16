// ═══════════════════════════════════════════════════════════════════════════
// RATES CONFIG UI 2025 — Tax Rates Reference Panel
// Depends on: rates-config-2025.js (RATES_CONFIG must be loaded first)
// ═══════════════════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  var CSS_ID = 'rates-config-ui-css';

  // ─── Inject panel CSS ─────────────────────────────────────────────────────
  function ensureCSS() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = [
      '.rc-panel { font-family: "IBM Plex Sans", system-ui, sans-serif; font-size: 13px; color: #1a1916; background: #fff; border: 1px solid #d0ccc4; border-radius: 4px; overflow: hidden; }',
      '.rc-panel-hdr { background: #1c3557; color: #fff; padding: 12px 16px; display: flex; align-items: center; gap: 10px; }',
      '.rc-panel-hdr h3 { margin: 0; font-size: 13px; font-weight: 600; flex: 1; }',
      '.rc-panel-hdr .rc-year-badge { background: #2a4f82; border: 1px solid #3a6fa8; color: #c8d8ee; font-size: 11px; padding: 2px 8px; border-radius: 10px; }',
      '.rc-tabs { display: flex; background: #f4f3f0; border-bottom: 1px solid #d0ccc4; overflow-x: auto; }',
      '.rc-tab { padding: 8px 14px; font-size: 11px; font-weight: 500; color: #4a4640; cursor: pointer; border: none; background: none; white-space: nowrap; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; }',
      '.rc-tab:hover { color: #1c3557; }',
      '.rc-tab.active { color: #1c3557; border-bottom-color: #1c3557; font-weight: 600; }',
      '.rc-content { padding: 14px 16px; }',
      '.rc-content-section { display: none; }',
      '.rc-content-section.active { display: block; }',
      '.rc-table { width: 100%; border-collapse: collapse; font-size: 12px; }',
      '.rc-table th { text-align: left; font-weight: 600; color: #4a4640; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 8px; border-bottom: 2px solid #e5e2dc; }',
      '.rc-table th:last-child, .rc-table td:last-child { text-align: right; }',
      '.rc-table td { padding: 6px 8px; border-bottom: 1px solid #f0ede8; vertical-align: top; color: #1a1916; }',
      '.rc-table tr:last-child td { border-bottom: none; }',
      '.rc-table tr:hover td { background: #f8f7f5; }',
      '.rc-mono { font-family: "IBM Plex Mono", monospace; }',
      '.rc-section-title { font-size: 11px; font-weight: 700; color: #1c3557; text-transform: uppercase; letter-spacing: 0.5px; margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e2dc; }',
      '.rc-note { font-size: 10px; color: #7a756e; margin-top: 6px; padding: 6px 10px; background: #f8f7f5; border-left: 3px solid #d0ccc4; border-radius: 0 3px 3px 0; }',
      '.rc-badge { display: inline-block; font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 10px; }',
      '.rc-badge-refund { background: #f0f7f2; color: #1a4d2e; border: 1px solid #a8d4b8; }',
      '.rc-badge-nr { background: #e8edf4; color: #1c3557; border: 1px solid #b0c0d8; }',
      '.rc-footer { padding: 6px 12px; background: #f4f3f0; border-top: 1px solid #e5e2dc; font-size: 10px; color: #aaa; text-align: right; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Format helpers ───────────────────────────────────────────────────────
  function euro(n) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return '€' + n.toLocaleString('en-IE');
  }

  function pct(n) {
    return (typeof n === 'number' ? (n * 100).toFixed(1) : '0.0') + '%';
  }

  // ─── Tab contents ─────────────────────────────────────────────────────────

  function buildBandsTab(R) {
    var rows = Object.keys(R.TAX_BANDS).map(function(key) {
      var b = R.TAX_BANDS[key];
      var extra = b.twoIncomeMax ? '<div style="font-size:10px;color:#7a756e">+ up to ' + euro(b.twoIncomeMax) + ' (2nd income)</div>' : '';
      return '<tr>'
        + '<td>' + key + extra + '</td>'
        + '<td>' + b.description + '</td>'
        + '<td class="rc-mono">' + euro(b.cutOff) + ' @ 20%</td>'
        + '<td class="rc-mono">Balance @ 40%</td>'
        + '</tr>';
    }).join('');

    return [
      '<div class="rc-section-title">Income Tax Bands — 2025</div>',
      '<table class="rc-table">',
      '<thead><tr><th>Type</th><th>Description</th><th>Standard Rate Band</th><th>Higher Rate</th></tr></thead>',
      '<tbody>' + rows + '</tbody>',
      '</table>',
      '<div class="rc-note">Standard rate: 20%. Higher rate: 40%. For married couples with two incomes, each spouse is entitled to the standard rate band up to the lower of their own income or €35,000 (cannot be transferred beyond the joint cap of €88,000).</div>',
    ].join('');
  }

  function buildCreditsTab(R) {
    var html = [];

    html.push('<div class="rc-section-title">Non-Refundable Tax Credits — 2025</div>');
    html.push('<table class="rc-table"><thead><tr><th>Credit</th><th>Amount</th><th>Notes</th></tr></thead><tbody>');

    var nrCredits = [
      ['PersonalCredit',           'Personal (Single)', R.CREDITS.PersonalCredit.amount],
      ['PersonalCreditMarried',    'Personal (Married)', R.CREDITS.PersonalCreditMarried.amount],
      ['PersonalCreditWidowedNoDep','Widowed (no dep. child)', R.CREDITS.PersonalCreditWidowedNoDep.amount],
      ['BereavementCredit',        'Year of Bereavement', R.CREDITS.BereavementCredit.amount],
      ['EmployeeCredit',           'Employee (PAYE)', R.CREDITS.EmployeeCredit.amount],
      ['EarnedIncomeCredit',       'Earned Income (s/e)', R.CREDITS.EarnedIncomeCredit.amount],
      ['SingleParentCredit',       'Single Person Child Carer', R.CREDITS.SingleParentCredit.amount],
      ['AgeCredit',                'Age (Single 65+)', R.CREDITS.AgeCredit.amountSingle],
      ['AgeCreditMarried',         'Age (Married 65+)', R.CREDITS.AgeCredit.amountMarried],
      ['HomeCarerCredit',          'Home Carer', R.CREDITS.HomeCarerCredit.amount],
      ['BlindCredit',              'Blind (Single)', R.CREDITS.BlindCredit.amountSingle],
      ['BlindCreditBoth',          'Blind (Both spouses)', R.CREDITS.BlindCredit.amountBoth],
      ['GuideDogCredit',           'Guide Dog', R.CREDITS.GuideDogCredit.amount],
      ['IncapacitatedChildCredit', 'Incapacitated Child', R.CREDITS.IncapacitatedChildCredit.amount],
      ['DependentRelativeCredit',  'Dependent Relative', R.CREDITS.DependentRelativeCredit.amount],
    ];

    nrCredits.forEach(function(c) {
      var notes = '';
      if (c[0] === 'DependentRelativeCredit') notes = 'Nil if relative income > €' + R.CREDITS.DependentRelativeCredit.incomeLimit.toLocaleString();
      if (c[0] === 'HomeCarerCredit') notes = 'Taper above €7,200; nil at €11,100+';
      if (c[0] === 'EarnedIncomeCredit') notes = 'Lesser of max or 20% of earned income';
      if (c[0] === 'BereavementCredit') notes = 'Year of death only';
      html.push('<tr><td>' + c[1] + '</td><td class="rc-mono">' + euro(c[2]) + '</td><td style="font-size:10px;color:#7a756e">' + notes + '</td></tr>');
    });

    html.push('</tbody></table>');

    html.push('<div class="rc-section-title" style="margin-top:14px">Refundable Credits — 2025</div>');
    html.push('<table class="rc-table"><thead><tr><th>Credit</th><th>Amount</th><th>Notes</th></tr></thead><tbody>');
    html.push('<tr><td>Rent Tax Credit (Single)</td><td class="rc-mono">' + euro(R.CREDITS.RentCredit.amountSingle) + '</td><td style="font-size:10px;color:#7a756e">Tenants in private rented accommodation</td></tr>');
    html.push('<tr><td>Rent Tax Credit (Married)</td><td class="rc-mono">' + euro(R.CREDITS.RentCredit.amountMarried) + '</td><td style="font-size:10px;color:#7a756e">Joint assessment</td></tr>');
    html.push('<tr><td>Mortgage Interest Relief</td><td class="rc-mono">' + euro(R.CREDITS.MortgageInterestCredit.amount) + '</td><td style="font-size:10px;color:#7a756e">Once-off 2024/2025; 20% of increased interest</td></tr>');
    html.push('</tbody></table>');

    return html.join('');
  }

  function buildUSCTab(R) {
    var html = [];

    html.push('<div class="rc-section-title">Standard USC Rates — 2025</div>');
    html.push('<table class="rc-table"><thead><tr><th>Band</th><th>Rate</th><th>Charge</th></tr></thead><tbody>');

    var prev = 0;
    R.USC.standardBands.forEach(function(b) {
      var from = prev;
      var to   = isFinite(b.to) ? b.to : null;
      var band = to ? (euro(from) + ' – ' + euro(to)) : ('Over ' + euro(from));
      var ex   = to ? '€' + ((to - from) * b.rate).toLocaleString('en-IE', {minimumFractionDigits:2,maximumFractionDigits:2}) + ' (on band)' : '';
      html.push('<tr><td>' + band + '</td><td class="rc-mono">' + pct(b.rate) + '</td><td style="font-size:10px;color:#7a756e">' + ex + '</td></tr>');
      prev = isFinite(b.to) ? b.to : prev;
    });
    html.push('</tbody></table>');

    html.push('<div class="rc-section-title" style="margin-top:14px">Reduced USC Rates (70+ / Medical Card)</div>');
    html.push('<table class="rc-table"><thead><tr><th>Band</th><th>Rate</th></tr></thead><tbody>');
    prev = 0;
    R.USC.reducedBands.forEach(function(b) {
      var from = prev;
      var to   = isFinite(b.to) ? b.to : null;
      var band = to ? (euro(from) + ' – ' + euro(to)) : ('Over ' + euro(from));
      html.push('<tr><td>' + band + '</td><td class="rc-mono">' + pct(b.rate) + '</td></tr>');
      prev = isFinite(b.to) ? b.to : prev;
    });
    html.push('</tbody></table>');

    html.push('<div class="rc-note">USC is exempt if total income ≤ €13,000. DSP, foreign income and deposit interest (DIRT) are excluded from the USC base.</div>');

    return html.join('');
  }

  function buildPRSITab(R) {
    var html = [];

    html.push('<div class="rc-section-title">PRSI Rates — 2025</div>');
    html.push('<table class="rc-table"><thead><tr><th>Class</th><th>Rate</th><th>Notes</th></tr></thead><tbody>');

    html.push('<tr><td>Class A (Employee)</td><td class="rc-mono">' + pct(R.PRSI.classA.rate) + '</td><td style="font-size:10px;color:#7a756e">Deducted at source via PAYE. Weekly exempt: €' + R.PRSI.classA.weeklyExempt + '. Weekly credit up to €' + R.PRSI.classA.weeklyCredit.max + '.</td></tr>');
    html.push('<tr><td>Class S (Self-Employed)</td><td class="rc-mono">' + pct(R.PRSI.classS.rate) + '</td><td style="font-size:10px;color:#7a756e">Min €' + R.PRSI.classS.minAnnual + '/yr if income > €5,000. Via self-assessment.</td></tr>');
    html.push('<tr><td>Class K (Unearned Income)</td><td class="rc-mono">' + pct(R.PRSI.classK.rate) + '</td><td style="font-size:10px;color:#7a756e">Rental, dividends, foreign etc. if total unearned > €5,000 (PAYE employees).</td></tr>');
    html.push('<tr><td>Class B/C/D (Modified)</td><td class="rc-mono">0%</td><td style="font-size:10px;color:#7a756e">No PRSI on employment. Class K applies on unearned income.</td></tr>');
    html.push('<tr><td>Class M</td><td class="rc-mono">0%</td><td style="font-size:10px;color:#7a756e">No PRSI liability.</td></tr>');

    html.push('</tbody></table>');
    html.push('<div class="rc-note">Persons aged 70+ are exempt from all PRSI. Deposit interest (DIRT) is a final liability — no PRSI charged. Class S minimum annual payment: €650.</div>');

    return html.join('');
  }

  function buildReliefsTab(R) {
    var html = [];

    html.push('<div class="rc-section-title">Key Reliefs &amp; Deductions — 2025</div>');
    html.push('<table class="rc-table"><thead><tr><th>Relief</th><th>Rate / Cap</th><th>Notes</th></tr></thead><tbody>');

    var items = [
      { name: 'Health Expenses (s.469)', rate: '20%', note: 'On net expenses (gross less recovery). No cap.' },
      { name: 'Pension Contributions', rate: '15%–40%', note: 'Age-banded. Earnings cap €115,000.' },
      { name: 'Tuition Fees (s.473A)', rate: '20%', note: 'Disregard: €3,000 (1st student), €1,500 (subsequent). Max €7,000/student.' },
      { name: 'Charitable Donations (s.848A)', rate: '31%', note: 'Min €250/year. Charity receives gross-up.' },
      { name: 'Flat Rate Expenses (s.114)', rate: 'Varies', note: 'Approved by Revenue per occupation.' },
      { name: 'Capital Allowances (s.284)', rate: '12.5%/yr', note: 'Wear & tear on plant/machinery (general rate).' },
      { name: 'Trade Losses (s.396)', rate: '100%', note: 'Current year losses; unused carried forward.' },
      { name: 'Farming Averaging (s.657)', rate: '5-yr avg', note: 'Opt-in annually.' },
      { name: 'Stock Relief (s.666)', rate: '25%', note: '100% for young/trained farmers.' },
      { name: 'Work From Home (s.114B)', rate: '€3.20/day', note: 'Per qualifying remote working day.' },
      { name: 'DIRT (s.261)', rate: '33%', note: 'Final liability. No IT/USC/PRSI on deposit interest.' },
      { name: 'CGT Annual Exemption', rate: '€1,270', note: 'Per individual per year. CGT rate: 33%.' },
    ];

    items.forEach(function(item) {
      html.push('<tr><td>' + item.name + '</td><td class="rc-mono">' + item.rate + '</td><td style="font-size:10px;color:#7a756e">' + item.note + '</td></tr>');
    });

    html.push('</tbody></table>');

    html.push('<div class="rc-section-title" style="margin-top:14px">Pension Age-Band Caps</div>');
    html.push('<table class="rc-table"><thead><tr><th>Age</th><th>Max % of NRE</th></tr></thead><tbody>');
    R.RELIEFS.Pension.ageBands.forEach(function(b) {
      var ageRange = b.maxAge === 999 ? b.minAge + '+' : b.minAge + '–' + b.maxAge;
      html.push('<tr><td>' + ageRange + '</td><td class="rc-mono">' + pct(b.cap) + '</td></tr>');
    });
    html.push('</tbody></table>');
    html.push('<div class="rc-note">NRE = Net Relevant Earnings. Earnings cap: €' + R.RELIEFS.Pension.earningsCap.toLocaleString() + '.</div>');

    return html.join('');
  }

  function buildFormRulesTab(R) {
    var html = [];

    html.push('<div class="rc-section-title">Form 11 — Self-Assessment (ROS)</div>');
    html.push('<div style="font-size:11px;color:#4a4640;margin-bottom:4px">Required when any of the following apply:</div>');
    html.push('<ul style="margin:0;padding-left:18px;font-size:11px;color:#1a1916">');
    R.FORM_TYPE_RULES.Form11.triggers.forEach(function(t) {
      html.push('<li style="margin-bottom:3px">' + t + '</li>');
    });
    html.push('</ul>');
    html.push('<div class="rc-note">Deadline: ' + R.FORM_TYPE_RULES.Form11.deadline + '. Filed via: ' + R.FORM_TYPE_RULES.Form11.filing + '.</div>');

    html.push('<div class="rc-section-title" style="margin-top:14px">Form 12 — PAYE Return (myAccount)</div>');
    html.push('<div style="font-size:11px;color:#4a4640;margin-bottom:4px">Restrictions (must not exceed):</div>');
    html.push('<ul style="margin:0;padding-left:18px;font-size:11px;color:#1a1916">');
    R.FORM_TYPE_RULES.Form12.restrictions.forEach(function(r) {
      html.push('<li style="margin-bottom:3px">' + r + '</li>');
    });
    html.push('</ul>');
    html.push('<div class="rc-note">Deadline: ' + R.FORM_TYPE_RULES.Form12.deadline + '. Filed via: ' + R.FORM_TYPE_RULES.Form12.filing + '.</div>');

    return html.join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // renderRatesPanel(containerId, options)
  //
  // containerId — ID of the target DOM element (string, no '#')
  // options     — { defaultTab: 'bands'|'credits'|'usc'|'prsi'|'reliefs'|'forms' }
  // ═══════════════════════════════════════════════════════════════════════════
  function renderRatesPanel(containerId, options) {
    if (typeof document === 'undefined') return;

    var R = global.RATES_CONFIG;
    if (!R) {
      console.error('renderRatesPanel: RATES_CONFIG not loaded. Include js/rates-config-2025.js before js/rates-config-ui.js.');
      return;
    }

    var container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

    if (!container) {
      console.error('renderRatesPanel: container "' + containerId + '" not found in DOM.');
      return;
    }

    options = options || {};
    var defaultTab = options.defaultTab || 'bands';

    ensureCSS();

    var panelId = 'rc-panel-' + (containerId || 'default');

    var tabs = [
      { id: 'bands',   label: 'Tax Bands' },
      { id: 'credits', label: 'Credits' },
      { id: 'usc',     label: 'USC' },
      { id: 'prsi',    label: 'PRSI' },
      { id: 'reliefs', label: 'Reliefs' },
      { id: 'forms',   label: 'Form Types' },
    ];

    var tabBar = tabs.map(function(t) {
      var active = t.id === defaultTab ? ' active' : '';
      return '<button class="rc-tab' + active + '" onclick="rcSwitchTab(\'' + panelId + '\',\'' + t.id + '\',this)">' + t.label + '</button>';
    }).join('');

    var sections = {
      bands:   buildBandsTab(R),
      credits: buildCreditsTab(R),
      usc:     buildUSCTab(R),
      prsi:    buildPRSITab(R),
      reliefs: buildReliefsTab(R),
      forms:   buildFormRulesTab(R),
    };

    var contentSections = tabs.map(function(t) {
      var active = t.id === defaultTab ? ' active' : '';
      return '<div class="rc-content-section' + active + '" id="' + panelId + '-' + t.id + '">' + sections[t.id] + '</div>';
    }).join('');

    container.innerHTML = [
      '<div class="rc-panel" id="' + panelId + '">',
      '  <div class="rc-panel-hdr">',
      '    <h3>📊 Irish Tax Rates Reference</h3>',
      '    <span class="rc-year-badge">Tax Year ' + R.year + '</span>',
      '  </div>',
      '  <div class="rc-tabs">' + tabBar + '</div>',
      '  <div class="rc-content">' + contentSections + '</div>',
      '  <div class="rc-footer">Source: Revenue.ie / Budget 2025 / Finance Act 2024</div>',
      '</div>',
    ].join('\n');
  }

  // ─── Tab switcher (global helper required for onclick) ────────────────────
  function rcSwitchTab(panelId, tabId, btn) {
    var panel = document.getElementById(panelId);
    if (!panel) return;

    // Update tab buttons
    var tabs = panel.parentElement.querySelectorAll('.rc-tab');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    if (btn) btn.classList.add('active');

    // Update content sections
    var sections = panel.querySelectorAll('.rc-content-section');
    sections.forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById(panelId + '-' + tabId);
    if (target) target.classList.add('active');
  }

  // Expose tab switcher globally (needed for onclick handlers in innerHTML)
  global.rcSwitchTab = rcSwitchTab;

  // ─── Public API ────────────────────────────────────────────────────────────
  var RATES_CONFIG_UI = {
    renderRatesPanel: renderRatesPanel,
    rcSwitchTab: rcSwitchTab,
  };

  global.RATES_CONFIG_UI = RATES_CONFIG_UI;

  // Convenience: auto-render if element with id 'rates-config-panel' exists at DOMContentLoaded
  if (typeof document !== 'undefined') {
    function _autoRender() {
      var el = document.getElementById('rates-config-panel');
      if (el) renderRatesPanel('rates-config-panel');
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _autoRender);
    } else {
      _autoRender();
    }
  }

})(typeof window !== 'undefined' ? window : this);
