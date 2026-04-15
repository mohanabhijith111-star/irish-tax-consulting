# Irish Tax Consulting — Internal Tool

A professional-grade, single-file Irish income tax computation system for tax advisers. Covers Form 11 and Form 12, all assessment modes, and produces a client-ready PDF with advisory letter.

---

## Features

### Client Queue (CRM)
- Client and return management with localStorage persistence
- Status tracking: Pending → In Progress → Under Review → Done
- History timeline per return (notes, status changes, computations)
- PDF download from queue without reopening the form
- Client detail editing (name, email, phone) directly from the drawer

### Tax Computation Engine
- **Tax years:** 2022 – 2026
- **Assessment modes:** Single, Joint, Separate Assessment, Separate Treatment
- **Form types:** Form 11 (self-assessed, ROS) and Form 12 (PAYE, myAccount) — auto-detected from income sources
- Income Tax at 20% / 40% with correct band splitting
- USC (all bands, medical card / age 70+ reduced rates)
- PRSI (Class A employment, Class S self-employed, Class K unearned)
- CGT on asset disposals with €1,270 annual exemption
- DIRT as final liability (excluded from IT/USC/PRSI)
- DWT on-account credit for Irish dividends

### Situation-Based Input (14 chips)
Activates only the panels relevant to each client:
- Employment / Pension (always on)
- Trade / Self-Employed (Sch. D Case I/II)
- Rental Income (Sch. D Case V — unlimited properties)
- Deposit Interest (DIRT @ 33%)
- Irish Dividends (DWT @ 25%)
- Foreign Income (with 75-country DTA treaty table)
- Capital Gains
- Exempt Income (Rent-a-Room, Artists S.195, Childcare, Forestry)
- Proprietary Director
- Health Expenses (S.469)
- Pension Contributions (AVC/PRSA/RAC — age-band cap enforcement)
- Tuition Fees (S.473A — per-student, disregard applied)
- Maintenance Paid
- Deed of Covenant
- PSWT / RCT Credits
- Farming (S.657 averaging, stock relief S.666/667B/667C, S.667D succession partnership)

### Credits & Deductions
- Accordion UI with grouped credits (Personal, Employment, Family, Disability, Housing, Age, Other)
- Revenue caps enforced: PAYE 20% rule, Earned Income Credit combined cap, Home Carer sliding scale
- Non-refundable credit floor at zero with unused-credit warning
- Refundable credits (Rent, Mortgage Interest) applied after
- Snapshot-stable credit IDs — `capRes.caps` lookups survive save/restore

### PDF Export (jsPDF)
- Page 1: Advisory letter with client address, tailored narrative paragraphs per situation
- Page 2: Client details cover sheet
- Pages 3+: Full tax computation per spouse (sections A–H)
- Summary page: charged vs paid vs balance table
- Uses `creditSnapshot` stored at compute time — correct even when called from queue

### Two-Column Live Proforma
- Left: scrollable input; Right: sticky live proforma
- Updates on every Calculate press
- Shows credit caps, DIRT final liability, DWT credit, PSWT/RCT, S.667D farm partnership credit

---

## Architecture

**Single HTML file — no build step, no dependencies (except jsPDF via CDN).**

```
index.html
├── CSS (embedded)
├── HTML structure
│   ├── Sidebar navigation
│   ├── Client Queue page
│   ├── Personal Tax page (2-column layout)
│   ├── Payroll Estimator page
│   ├── Tax Reference page
│   └── Key Deadlines page
└── JavaScript (embedded, ~7,500 lines)
    ├── RATES object (2022–2026 bands, credits, USC, PRSI)
    ├── CREDIT_CATALOGUE & DEDUCTION_CATALOGUE
    ├── creditStore / deductionStore (runtime state)
    ├── Situation chip system & panel injection
    ├── Income panels (C, G1, G2, G3, F, H, P, M, K, W, B, E, T)
    ├── computeSpouse / computeSingle / computeJoint / computeSeparate
    ├── applyCreditCaps (Revenue cap rules)
    ├── calcUSC / calcIT / calcPRSISplit / calcCGTTotal
    ├── buildSpouseProforma / renderJointResult / renderSeparateResult
    ├── downloadPDF (jsPDF — advisory letter + computation)
    ├── Client queue (localStorage: itc_clients / itc_returns)
    └── Snapshot save/restore (form state + credits + panels)
```

---

## Data Storage

All data is stored in the **browser's localStorage** — nothing leaves the device. No server, no database, no authentication.

| Key | Contents |
|-----|----------|
| `itc_clients` | Client records (name, PPS, DOB, email, phone, address) |
| `itc_returns` | Returns (tax year, status, snapshot, history) |

**No client data is ever committed to this repository.**

---

## Tax Rates — Quick Reference

| Year | IT Band (Single) | USC Band 2 ceiling | USC Band 3 | Employee PRSI |
|------|-----------------|-------------------|------------|---------------|
| 2022 | €36,800 | €21,295 | 4.5% | 4.0% |
| 2023 | €40,000 | €22,920 | 4.5% | 4.0% |
| 2024 | €42,000 | €25,760 | 4.0% | 4.1% |
| 2025 | €44,000 | €27,382 | 3.0% | 4.2% |
| 2026 | €44,000 | €28,700 | 3.0% | 4.2% |

---

## Development Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Computation bug fixes (DIRT, DWT, rental F12 visibility, med relief) |
| 2 | ✅ Done | Two-column layout, situation chips, panel injection system |
| 3 | ✅ Done | Income panels (Rental, DIRT, DWT, Other, Foreign, Exempt) |
| 4 | ✅ Done | Credits accordion, Pension/Maintenance/Covenant/PSWT panels, Tax Paid zones |
| 5 | ✅ Done | Farming Panel B (averaging, stock relief, YTF, succession partnership) |
| 6 | ✅ Done | Health expenses, Tuition Fees, PDF export overhaul, advisory letter |
| 7 | 🔲 Planned | Client intake form → auto-populate tool |
| 8 | 🔲 Planned | Email chasing automation, missing document flags |
| 9 | 🔲 Planned | Stripe fee collection gating |
| 10 | 🔲 Planned | ROS filing integration (requires Revenue ASP status) |

---

## Usage

Open `index.html` in any modern browser. No installation required.

For hosted access, enable GitHub Pages:
- Settings → Pages → Deploy from branch `main` → folder `/`
- Live at: `https://mohanabhijith111-star.github.io/irish-tax-consulting`

---

## Contributing

Branch per feature/fix. Merge to `main` via PR.

```bash
git checkout -b fix/issue-description
# make changes to index.html
git add index.html
git commit -m "fix: describe what was fixed"
git push origin fix/issue-description
```

---

## Disclaimer

This tool is for internal professional use by qualified tax advisers. It does not constitute formal tax advice to end clients. All computations should be verified against Revenue guidance and the relevant Finance Acts before filing.

Rates sourced from Revenue.ie and Finance Acts 2022–2026.
