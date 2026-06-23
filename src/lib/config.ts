export const COMPANY = {
  name: 'Chi Dental Lab',
  address: 'No179-1 Jalan SS 2/24, SS 2, 47300 Petaling Jaya, Selangor',
  phone: '01155627949',
  email: 'chidentallab@gmail.com',
}

// Default SST tax rate (%) prefilled on a new invoice (Wave 5). Ships at 0 — the
// tax line stays hidden until the accountant confirms the service-tax rate +
// threshold, at which point only this constant changes (and existing invoices
// keep their saved per-invoice rate).
export const DEFAULT_TAX_RATE = 0

export const BANK = {
  bankName: 'Public Bank',
  accountName: 'Chi Dental Lab Sdn Bhd',
  accountNumber: '3249402703',
  paymentNote: 'Please use invoice number as payment reference',
}
