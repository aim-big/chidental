// Shared mock data for the /demo redesign. One dataset feeds every demo page so
// the same clinics / invoices / jobs appear consistently across tabs — the way a
// real app would. No server, no auth. MYR (RM) throughout. Vocabulary mirrors the
// real app (invoice statuses, work stages, clinic active/archived, etc.).

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

// ── Clinics (UI: "Clinic"; code/DB: customer) ────────────────────────────────
export type Clinic = {
  id: string
  name: string
  contact: string
  phone: string
  email: string
  city: string
  status: 'active' | 'archived'
  registered: string // ISO
  outstanding: number
  ytd: number
  openJobs: number
}

export const CLINICS: Clinic[] = [
  { id: 'c1', name: 'Klinik Pergigian Sri Damansara', contact: 'Dr. Lim Wei Sheng', phone: '03-6272 8841', email: 'sridamansara@dental.my', city: 'Petaling Jaya', status: 'active', registered: '2023-03-14', outstanding: 24300, ytd: 148200, openJobs: 6 },
  { id: 'c2', name: 'Smile Dental · Bangsar', contact: 'Dr. Nurul Aisyah', phone: '03-2201 7730', email: 'hello@smilebangsar.my', city: 'Kuala Lumpur', status: 'active', registered: '2023-06-02', outstanding: 19850, ytd: 132600, openJobs: 4 },
  { id: 'c3', name: 'Kota Damansara Dental', contact: 'Dr. Ganesh Kumar', phone: '03-6151 2298', email: 'admin@kddental.my', city: 'Petaling Jaya', status: 'active', registered: '2024-01-20', outstanding: 16400, ytd: 98400, openJobs: 3 },
  { id: 'c4', name: 'Dr. Tan Dental Surgery', contact: 'Dr. Tan Mei Ling', phone: '03-7980 4412', email: 'front@tandental.my', city: 'Puchong', status: 'active', registered: '2022-11-08', outstanding: 12900, ytd: 87500, openJobs: 2 },
  { id: 'c5', name: 'Pusat Pergigian Ampang', contact: 'Dr. Faridah Yusof', phone: '03-4270 6653', email: 'ampang@pergigian.my', city: 'Ampang', status: 'active', registered: '2024-05-30', outstanding: 9750, ytd: 76200, openJobs: 5 },
  { id: 'c6', name: 'Klinik Gigi Setapak', contact: 'Dr. Ong Chee Keong', phone: '03-4023 1187', email: 'setapak@gigi.my', city: 'Kuala Lumpur', status: 'active', registered: '2024-09-12', outstanding: 4100, ytd: 54900, openJobs: 1 },
  { id: 'c7', name: 'Bangsar Smile Studio', contact: 'Dr. Priya Nair', phone: '03-2856 9910', email: 'care@bangsarsmile.my', city: 'Kuala Lumpur', status: 'active', registered: '2025-02-18', outstanding: 0, ytd: 61300, openJobs: 0 },
  { id: 'c8', name: 'Mount Kiara Dental', contact: 'Dr. James Wong', phone: '03-6201 4478', email: 'mk@mkdental.my', city: 'Kuala Lumpur', status: 'archived', registered: '2021-07-25', outstanding: 0, ytd: 12800, openJobs: 0 },
]

// ── Services / products ──────────────────────────────────────────────────────
export type ServiceCategory = 'Crown & Bridge' | 'Implant' | 'Removable' | 'Appliance' | 'Misc'
export type Service = {
  id: string
  name: string
  description: string
  category: ServiceCategory
  unit: string
  price: number
  priceMax?: number // set → price range
  active: boolean
  jobsThisMonth: number
}

export const SERVICES: Service[] = [
  { id: 's1', name: 'Zirconia Crown', description: 'Full-contour monolithic zirconia', category: 'Crown & Bridge', unit: 'unit', price: 350, active: true, jobsThisMonth: 118 },
  { id: 's2', name: 'PFM Crown', description: 'Porcelain fused to metal', category: 'Crown & Bridge', unit: 'unit', price: 280, active: true, jobsThisMonth: 81 },
  { id: 's3', name: 'E-max Veneer', description: 'Lithium disilicate laminate', category: 'Crown & Bridge', unit: 'unit', price: 420, priceMax: 480, active: true, jobsThisMonth: 34 },
  { id: 's4', name: 'Custom Implant Abutment', description: 'Titanium, milled to case', category: 'Implant', unit: 'unit', price: 480, active: true, jobsThisMonth: 38 },
  { id: 's5', name: 'Screw-retained Implant Crown', description: 'Zirconia on Ti-base', category: 'Implant', unit: 'unit', price: 550, active: true, jobsThisMonth: 22 },
  { id: 's6', name: 'Full Denture (Acrylic)', description: 'Heat-cured, per arch', category: 'Removable', unit: 'arch', price: 900, active: true, jobsThisMonth: 16 },
  { id: 's7', name: 'Partial Denture (Cobalt-Chrome)', description: 'Cast framework + teeth', category: 'Removable', unit: 'arch', price: 750, priceMax: 950, active: true, jobsThisMonth: 11 },
  { id: 's8', name: 'Night Guard (Hard)', description: 'Bruxism splint', category: 'Appliance', unit: 'unit', price: 220, active: true, jobsThisMonth: 27 },
  { id: 's9', name: 'Essix Retainer', description: 'Clear vacuum-formed', category: 'Appliance', unit: 'unit', price: 150, active: true, jobsThisMonth: 19 },
  { id: 's10', name: 'Study Model / Cast', description: 'Diagnostic model', category: 'Misc', unit: 'unit', price: 40, active: false, jobsThisMonth: 0 },
]

// ── Invoices ─────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'voided'
export type Invoice = {
  id: string
  number: string
  clinic: string
  patient: string
  date: string
  due: string
  amount: number
  paid: number
  status: InvoiceStatus
}

export const INVOICES: Invoice[] = [
  { id: 'i1', number: 'INV-2026-0148', clinic: 'Klinik Pergigian Sri Damansara', patient: 'Tan Wei Ming', date: '2026-07-04', due: '2026-08-03', amount: 8450, paid: 0, status: 'issued' },
  { id: 'i2', number: 'INV-2026-0147', clinic: 'Smile Dental · Bangsar', patient: 'Nurul Aisyah', date: '2026-07-03', due: '2026-08-02', amount: 6120, paid: 3000, status: 'partial' },
  { id: 'i3', number: 'INV-2026-0146', clinic: 'Kota Damansara Dental', patient: 'Lim Choon Hui', date: '2026-07-02', due: '2026-08-01', amount: 4980, paid: 4980, status: 'paid' },
  { id: 'i4', number: 'INV-2026-0145', clinic: 'Dr. Tan Dental Surgery', patient: 'Rajesh Kumar', date: '2026-07-01', due: '2026-07-31', amount: 3260, paid: 0, status: 'issued' },
  { id: 'i5', number: 'INV-2026-0140', clinic: 'Pusat Pergigian Ampang', patient: 'Siti Zubaidah', date: '2026-06-20', due: '2026-07-05', amount: 5400, paid: 0, status: 'overdue' },
  { id: 'i6', number: 'INV-2026-0136', clinic: 'Klinik Gigi Setapak', patient: 'Wong Mei Ling', date: '2026-06-18', due: '2026-07-18', amount: 2100, paid: 2100, status: 'paid' },
  { id: 'i7', number: 'INV-2026-0132', clinic: 'Bangsar Smile Studio', patient: 'Farid Hassan', date: '2026-06-14', due: '2026-07-14', amount: 7350, paid: 7350, status: 'paid' },
  { id: 'i8', number: 'INV-2026-0128', clinic: 'Klinik Pergigian Sri Damansara', patient: 'Chong Aik Seng', date: '2026-06-11', due: '2026-06-26', amount: 9200, paid: 5000, status: 'overdue' },
  { id: 'i9', number: 'INV-2026-0149', clinic: 'Mount Kiara Dental', patient: 'Vincent Low', date: '2026-07-05', due: '2026-08-04', amount: 1480, paid: 0, status: 'draft' },
  { id: 'i10', number: 'INV-2026-0125', clinic: 'Dr. Tan Dental Surgery', patient: 'Aina Sofea', date: '2026-06-09', due: '2026-07-09', amount: 3900, paid: 3900, status: 'paid' },
  { id: 'i11', number: 'INV-2026-0120', clinic: 'Kota Damansara Dental', patient: 'Harith Danial', date: '2026-05-28', due: '2026-06-27', amount: 2760, paid: 0, status: 'voided' },
  { id: 'i12', number: 'INV-2026-0150', clinic: 'Pusat Pergigian Ampang', patient: 'Kavitha Menon', date: '2026-07-05', due: '2026-08-04', amount: 990, paid: 0, status: 'draft' },
]

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Issued', tone: 'info' },
  partial: { label: 'Partial', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'danger' },
  voided: { label: 'Voided', tone: 'danger' },
}

// ── Payments (Reports · Collected) ───────────────────────────────────────────
export type Payment = { id: string; date: string; invoice: string; clinic: string; ref: string; amount: number }
export const PAYMENTS: Payment[] = [
  { id: 'p1', date: '2026-07-04', invoice: 'INV-2026-0146', clinic: 'Kota Damansara Dental', ref: 'TRF-88213', amount: 4980 },
  { id: 'p2', date: '2026-07-03', invoice: 'INV-2026-0147', clinic: 'Smile Dental · Bangsar', ref: 'DuitNow', amount: 3000 },
  { id: 'p3', date: '2026-07-02', invoice: 'INV-2026-0136', clinic: 'Klinik Gigi Setapak', ref: 'CHQ-4471', amount: 2100 },
  { id: 'p4', date: '2026-06-30', invoice: 'INV-2026-0132', clinic: 'Bangsar Smile Studio', ref: 'TRF-88190', amount: 7350 },
  { id: 'p5', date: '2026-06-27', invoice: 'INV-2026-0128', clinic: 'Klinik Pergigian Sri Damansara', ref: 'DuitNow', amount: 5000 },
  { id: 'p6', date: '2026-06-24', invoice: 'INV-2026-0125', clinic: 'Dr. Tan Dental Surgery', ref: 'CHQ-4460', amount: 3900 },
]

// ── Work items (lab production) ──────────────────────────────────────────────
export type WorkStage = 'received' | 'in_progress' | 'ready' | 'on_hold' | 'delivered'
export type WorkItem = {
  id: string
  invoiceNo: string
  caseRef: string
  clinic: string
  patient: string
  service: string
  shade: string
  due: string
  stage: WorkStage
  subStage?: string // in-progress sub-status
  updatedAgo: string
  overdue?: boolean
}

export const WORK_STAGES: { key: WorkStage; label: string; color: string; tone: Tone }[] = [
  { key: 'received', label: 'Received', color: '#0ea5e9', tone: 'info' },
  { key: 'in_progress', label: 'In progress', color: '#f59e0b', tone: 'warning' },
  { key: 'ready', label: 'Ready', color: '#22c55e', tone: 'success' },
  { key: 'on_hold', label: 'On hold', color: '#94a3b8', tone: 'neutral' },
  { key: 'delivered', label: 'Delivered', color: '#a8a29e', tone: 'neutral' },
]

export const WORK_ITEMS: WorkItem[] = [
  { id: 'w1', invoiceNo: 'INV-2026-0148', caseRef: 'CS-4471', clinic: 'Klinik Pergigian Sri Damansara', patient: 'Tan Wei Ming', service: 'Zirconia Crown ×2', shade: 'A2', due: '2026-07-08', stage: 'received', updatedAgo: '2h ago' },
  { id: 'w2', invoiceNo: 'INV-2026-0145', caseRef: 'CS-4470', clinic: 'Pusat Pergigian Ampang', patient: 'Siti Zubaidah', service: 'PFM Crown', shade: 'A3', due: '2026-07-07', stage: 'received', updatedAgo: '5h ago' },
  { id: 'w3', invoiceNo: 'INV-2026-0147', caseRef: 'CS-4469', clinic: 'Smile Dental · Bangsar', patient: 'Nurul Aisyah', service: 'E-max Veneer ×4', shade: 'B1', due: '2026-07-06', stage: 'received', updatedAgo: '1d ago', overdue: true },
  { id: 'w4', invoiceNo: 'INV-2026-0146', caseRef: 'CS-4462', clinic: 'Kota Damansara Dental', patient: 'Lim Choon Hui', service: 'Custom Implant Abutment', shade: '—', due: '2026-07-09', stage: 'in_progress', subStage: 'Design (CAD)', updatedAgo: '3h ago' },
  { id: 'w5', invoiceNo: 'INV-2026-0125', caseRef: 'CS-4460', clinic: 'Dr. Tan Dental Surgery', patient: 'Aina Sofea', service: 'Full Denture (Acrylic)', shade: 'A2', due: '2026-07-10', stage: 'in_progress', subStage: 'Try-in', updatedAgo: '6h ago' },
  { id: 'w6', invoiceNo: 'INV-2026-0136', caseRef: 'CS-4458', clinic: 'Klinik Gigi Setapak', patient: 'Wong Mei Ling', service: 'Zirconia Crown', shade: 'A1', due: '2026-07-06', stage: 'in_progress', subStage: 'Milling', updatedAgo: '1d ago', overdue: true },
  { id: 'w7', invoiceNo: 'INV-2026-0132', caseRef: 'CS-4457', clinic: 'Bangsar Smile Studio', patient: 'Farid Hassan', service: 'Screw-retained Implant Crown', shade: 'A2', due: '2026-07-11', stage: 'in_progress', subStage: 'Finishing', updatedAgo: '4h ago' },
  { id: 'w8', invoiceNo: 'INV-2026-0147', caseRef: 'CS-4451', clinic: 'Smile Dental · Bangsar', patient: 'Nurul Aisyah', service: 'Night Guard (Hard)', shade: '—', due: '2026-07-08', stage: 'ready', updatedAgo: '2h ago' },
  { id: 'w9', invoiceNo: 'INV-2026-0148', caseRef: 'CS-4449', clinic: 'Klinik Pergigian Sri Damansara', patient: 'Tan Wei Ming', service: 'PFM Crown ×3', shade: 'A3.5', due: '2026-07-09', stage: 'ready', updatedAgo: '8h ago' },
  { id: 'w10', invoiceNo: 'INV-2026-0146', caseRef: 'CS-4444', clinic: 'Kota Damansara Dental', patient: 'Harith Danial', service: 'Partial Denture (Co-Cr)', shade: 'B2', due: '2026-07-12', stage: 'on_hold', updatedAgo: '2d ago' },
  { id: 'w11', invoiceNo: 'INV-2026-0125', caseRef: 'CS-4440', clinic: 'Dr. Tan Dental Surgery', patient: 'Aina Sofea', service: 'E-max Veneer ×2', shade: 'A1', due: '2026-07-14', stage: 'on_hold', updatedAgo: '3d ago' },
  { id: 'w12', invoiceNo: 'INV-2026-0132', caseRef: 'CS-4433', clinic: 'Bangsar Smile Studio', patient: 'Farid Hassan', service: 'Retainer (Essix)', shade: '—', due: '2026-07-02', stage: 'delivered', updatedAgo: '2d ago' },
]

// ── Money / date helpers (kept local so demo pages don't reach into app lib) ──
export function rm(n: number): string {
  const cents = Math.round(n * 100) % 100 !== 0
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency', currency: 'MYR',
    minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2,
  }).format(n)
}

export function rmCompact(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `RM${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (a >= 1_000) return `RM${(n / 1_000).toFixed(0)}k`
  return `RM${n}`
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${String(y).slice(2)}`
}

// Days overdue relative to the demo "today" (2026-07-05). Positive = overdue.
export function daysOverdue(dueIso: string): number {
  const due = Date.parse(dueIso + 'T00:00:00Z')
  const today = Date.parse('2026-07-05T00:00:00Z')
  return Math.round((today - due) / 86_400_000)
}
