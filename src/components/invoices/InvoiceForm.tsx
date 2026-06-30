'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/feedback/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { formatCurrency, cn } from '@/lib/utils'
import { ArrowLeft, ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react'
import type { InvoiceStatus, Product } from '@/lib/database.types'
import { addDays, format } from 'date-fns'
import { DEFAULT_COLOR } from '@/lib/service-status'
import { canEditInvoice } from '@/lib/invoice-permissions'
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard'
import { createInvoiceAction, updateInvoiceAction } from '@/data/invoice-actions'
import type { InvoicePayload, InvoiceItemPayload } from '@/data/invoice-actions'
import type { InvoiceFormData, InvoiceForEdit } from '@/data/invoices'
import { ProductSearchAdd } from './ProductSearchAdd'
import { ServiceStatusSelectItem } from './ServiceStatusSelectItem'
import { ManageOptionsLink } from '@/components/ui/manage-options-link'

interface LineItem {
  id: string | null            // existing invoice_items.id, or null for a new row
  product_id: string | null
  description: string          // prints on the invoice; defaults to the product name
  quantity: number
  unit_price: number
}

// Hide the native number-input spin buttons (qty / unit price are typed, not stepped).
const noSpin =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

function formatPriceRange(min: number, max: number): string {
  const maxWithoutCurrency = formatCurrency(max).replace(/^RM[\s\u00a0]*/, '')
  return `${formatCurrency(min)} - ${maxWithoutCurrency}`
}

export default function InvoiceForm({
  invoiceId,
  formData,
  editData,
}: {
  invoiceId?: string
  formData: InvoiceFormData
  editData?: InvoiceForEdit
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, loading: authLoading } = useAuth()
  const { show } = useToast()
  const isEdit = Boolean(invoiceId)

  // Reference data arrives from the server wrapper as props.
  const { customers, products, serviceStatuses } = formData
  const editInvoice = editData?.invoice ?? null

  const [customerId, setCustomerId] = useState(editInvoice?.customer_id ?? searchParams.get('customer') ?? '')
  const [invoiceDate, setInvoiceDate] = useState(editInvoice?.invoice_date ?? format(new Date(), 'yyyy-MM-dd'))
  // Due date is no longer captured in the UI. It's still stored (the column is
  // NOT NULL and drives A/R aging) but always derived as invoice date +
  // DEFAULT_PAYMENT_TERMS_DAYS — see invoicePayload(). A configurable term can
  // replace the constant later without bringing the field back.
  // Single invoice-level remark. Internal only — never printed or shown to the
  // customer. Persisted to invoices.notes (the column kept its name).
  const [remarks, setRemarks] = useState(editInvoice?.notes ?? '')
  const [patient, setPatient] = useState(editInvoice?.patient ?? '')
  const [doctor, setDoctor] = useState(editInvoice?.doctor ?? '')
  const [serviceStatusId, setServiceStatusId] = useState<string | null>(editInvoice?.service_status_id ?? null)
  const [items, setItems] = useState<LineItem[]>(() =>
    (editData?.items ?? []).map(r => ({
      id: r.id,
      product_id: r.product_id,
      description: r.description,
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price),
    })),
  )
  const [billToName, setBillToName] = useState(editInvoice?.bill_to_name ?? '')
  const [billToContact, setBillToContact] = useState(editInvoice?.bill_to_contact ?? '')
  const [billToPhone, setBillToPhone] = useState(editInvoice?.bill_to_phone ?? '')
  const [billingAddress, setBillingAddress] = useState(editInvoice?.billing_address ?? '')
  const [shipToName, setShipToName] = useState(editInvoice?.ship_to_name ?? '')
  const [shipToContact, setShipToContact] = useState(editInvoice?.ship_to_contact ?? '')
  const [deliveryAddress, setDeliveryAddress] = useState(editInvoice?.delivery_address ?? '')
  const [showRecipient, setShowRecipient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Set true once a save succeeds, so the unsaved-changes guard stands down
  // before the post-save `router.push`.
  const [saved, setSaved] = useState(false)
  // Status of the loaded invoice (edit mode) — drives the edit lock guard + banner.
  const [loadedStatus] = useState<InvoiceStatus | null>(
    editInvoice ? (editInvoice.status as InvoiceStatus) : null,
  )
  // Void (soft-delete) marker of the loaded invoice — voided invoices are locked for everyone.
  const [loadedVoidedAt] = useState<string | null>(editInvoice?.voided_at ?? null)

  // The customer id whose recipient defaults are already reflected in the form.
  // Guards the auto-fill effect so it doesn't clobber an invoice's saved recipient on load.
  // In edit mode we pre-seed it with the loaded invoice's customer so the saved
  // recipient values survive the initial render of the auto-fill effect.
  const recipientSyncRef = useRef<string | null>(editInvoice?.customer_id ?? null)

  const selectedCustomer = customers.find(c => c.id === customerId) ?? null

  // Edit lock: staff may only edit drafts; admins may edit any non-void invoice.
  // Deep-links to a locked invoice are redirected back to its detail page.
  useEffect(() => {
    if (!isEdit || authLoading || loadedStatus === null) return
    if (!canEditInvoice({ status: loadedStatus, voided_at: loadedVoidedAt }, hasPermission)) {
      router.replace(`/invoices/${invoiceId}`)
    }
  }, [isEdit, authLoading, loadedStatus, loadedVoidedAt, hasPermission, invoiceId, router])

  // Create lock: making a new invoice needs invoices.create. The /invoices/new
  // route already gates server-side; this redirects back if the form is reached
  // without the permission (separate capability from invoices.edit).
  useEffect(() => {
    if (isEdit || authLoading) return
    if (!hasPermission('invoices.create')) router.replace('/invoices')
  }, [isEdit, authLoading, hasPermission, router])

  // When the user picks a (different) customer, fill the recipient block from that
  // customer's master record. Deliberate external-sync effect: it must also run
  // once `customers` finishes loading for a URL-preselected customer, so the logic
  // can't live solely in the Select's onChange. The ref guard skips the initial
  // edit-mode load so saved recipients aren't clobbered, and the grouped setState
  // calls batch into a single render — no cascading-render problem here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (customers.length === 0 && customerId) return
    if (recipientSyncRef.current === customerId) return
    recipientSyncRef.current = customerId
    const c = customers.find(x => x.id === customerId) ?? null
    if (!c) {
      setBillToName(''); setBillToContact(''); setBillToPhone(''); setBillingAddress('')
      setShipToName(''); setShipToContact(''); setDeliveryAddress('')
      return
    }
    setBillToName(c.clinic_name ?? '')
    setBillToContact(c.contact_person ?? '')
    setBillToPhone(c.phone ?? '')
    setBillingAddress(c.billing_address ?? '')
    setShipToName(c.clinic_name ?? '')
    setShipToContact(c.contact_person ?? '')
    setDeliveryAddress(c.delivery_address ?? '')
  }, [customerId, customers])
  /* eslint-enable react-hooks/set-state-in-effect */

  const recipientDirty = selectedCustomer
    ? billToName !== (selectedCustomer.clinic_name ?? '')
      || billToContact !== (selectedCustomer.contact_person ?? '')
      || billToPhone !== (selectedCustomer.phone ?? '')
      || billingAddress !== (selectedCustomer.billing_address ?? '')
      || shipToName !== (selectedCustomer.clinic_name ?? '')
      || shipToContact !== (selectedCustomer.contact_person ?? '')
      || deliveryAddress !== (selectedCustomer.delivery_address ?? '')
    : false

  const restoreFromCustomer = () => {
    if (!selectedCustomer) return
    setBillToName(selectedCustomer.clinic_name ?? '')
    setBillToContact(selectedCustomer.contact_person ?? '')
    setBillToPhone(selectedCustomer.phone ?? '')
    setBillingAddress(selectedCustomer.billing_address ?? '')
    setShipToName(selectedCustomer.clinic_name ?? '')
    setShipToContact(selectedCustomer.contact_person ?? '')
    setDeliveryAddress(selectedCustomer.delivery_address ?? '')
  }

  const currentServiceStatus = serviceStatuses.find(s => s.id === serviceStatusId) ?? null

  const updateItem = useCallback((index: number, field: keyof LineItem, value: string | number | null) => {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }, [])

  // Product-first add: a picked product seeds the line (description = name,
  // price = catalog default). Picking the same product twice adds a second line.
  const addProduct = useCallback((p: Product) => {
    setItems(prev => [
      ...prev,
      { id: null, product_id: p.id, description: p.name, quantity: 1, unit_price: p.unit_price },
    ])
  }, [])

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const subtotal = items.reduce((s, item) => s + item.quantity * item.unit_price, 0)
  const total = subtotal

  const itemPriceErrors = items.map(item => {
    if (!item.product_id) return null
    const p = products.find(x => x.id === item.product_id)
    if (!p || p.min_unit_price == null || p.max_unit_price == null) return null
    if (item.unit_price < p.min_unit_price || item.unit_price > p.max_unit_price) {
      return formatPriceRange(p.min_unit_price, p.max_unit_price)
    }
    return null
  })
  const hasItemPriceErrors = itemPriceErrors.some(Boolean)

  // Dirty tracking: serialize every user-editable field and compare to the
  // snapshot taken on first render. Cheap and exhaustive — any edit (header,
  // recipient, items) flips `dirty`, which arms the unsaved-changes guard.
  const snapshot = JSON.stringify({
    customerId, invoiceDate, remarks, patient, doctor, serviceStatusId,
    billToName, billToContact, billToPhone, billingAddress,
    shipToName, shipToContact, deliveryAddress, items,
  })
  // Lazy initializer captures the snapshot exactly once (first render).
  const [initialSnapshot] = useState(snapshot)
  const dirty = !saved && snapshot !== initialSnapshot
  useUnsavedChangesGuard(dirty)

  const invoicePayload = (): InvoicePayload => ({
    customer_id: customerId,
    invoice_date: invoiceDate,
    // Due date is derived, never entered: invoice date + the lab's standard
    // payment terms (configured in Settings → Billing). The column is NOT NULL
    // and feeds A/R aging.
    due_date: format(addDays(new Date(invoiceDate), formData.paymentTermsDays), 'yyyy-MM-dd'),
    notes: remarks.trim() || null,
    patient: patient || null,
    doctor: doctor || null,
    service_status_id: serviceStatusId,
    bill_to_name: billToName.trim() || null,
    bill_to_contact: billToContact.trim() || null,
    bill_to_phone: billToPhone.trim() || null,
    billing_address: billingAddress.trim() || null,
    // Deliver-to is always captured; the invoice document decides whether to
    // render a separate Deliver To column based on whether it differs from Bill To.
    ship_to_name: shipToName.trim() || null,
    ship_to_contact: shipToContact.trim() || null,
    delivery_address: deliveryAddress.trim() || null,
    subtotal,
    total,
  })

  const validate = () => {
    if (!customerId) { setError('Please select a clinic.'); return false }
    if (!patient.trim()) { setError('Patient name is required.'); return false }
    if (!doctor.trim()) { setError('Doctor name is required.'); return false }
    if (!invoiceDate) { setError('Invoice date is required.'); return false }
    if (items.length === 0) { setError('Add at least one item.'); return false }
    if (items.some(i => !i.description.trim())) { setError('Every line needs a description.'); return false }
    if (items.some(i => !(i.quantity > 0))) { setError('Quantity must be greater than 0.'); return false }
    if (hasItemPriceErrors) { setError('Some line items are outside the allowed price range.'); return false }
    return true
  }

  const handleCreate = async (status: 'draft' | 'sent') => {
    if (!validate()) return
    setSaving(true)
    setError('')

    const itemsPayload: InvoiceItemPayload[] = items
      .filter(i => i.description.trim())
      .map(i => ({
        product_id: i.product_id,
        description: i.description.trim(),
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: i.quantity * i.unit_price,
      }))

    // Single transactional action: invoice header + all items succeed or fail
    // together. The action injects created_by; status comes from the caller.
    const result = await createInvoiceAction({
      p_invoice: { ...invoicePayload(), status },
      p_items: itemsPayload,
    })

    if (result.ok === false) {
      show({ variant: 'error', title: result.error })
      setSaving(false)
      return
    }
    setSaved(true)
    show({ variant: 'success', title: 'Invoice created' })
    router.push(`/invoices/${result.id}`)
  }

  const handleUpdate = async () => {
    if (!invoiceId || !validate()) return
    setSaving(true)
    setError('')

    // The action diffs items by id: rows with an id are updated, rows without are
    // inserted, and any previously-saved id absent from this list is deleted —
    // all inside one transaction.
    const itemsPayload: InvoiceItemPayload[] = items
      .filter(i => i.description.trim())
      .map(i => ({
        id: i.id,
        product_id: i.product_id,
        description: i.description.trim(),
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: i.quantity * i.unit_price,
      }))

    const result = await updateInvoiceAction(invoiceId, {
      p_invoice: invoicePayload(),
      p_items: itemsPayload,
    })
    if (result.ok === false) {
      show({ variant: 'error', title: result.error })
      setSaving(false)
      return
    }
    setSaved(true)
    show({ variant: 'success', title: 'Invoice updated' })
    router.push(`/invoices/${invoiceId}`)
  }

  // Enter-to-save: the form's primary submit. Edit mode saves; create mode does
  // the primary "Create" (issues the invoice). Guarded so a save can't double-fire while one
  // is in flight or while line items have price errors.
  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || hasItemPriceErrors) return
    if (isEdit) handleUpdate()
    else handleCreate('sent')
  }

  // Line Items wrapper ref: Enter pressed inside the item editor (qty / price /
  // descriptions / the product-search filter) must NOT submit the form — the
  // user is editing a row, not finishing the invoice. Enter in the header text
  // fields still submits.
  const lineItemsRef = useRef<HTMLDivElement>(null)
  const onFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    // Textareas legitimately use Enter for newlines; never submit from one.
    if (target.tagName === 'TEXTAREA') return
    if (lineItemsRef.current?.contains(target)) {
      e.preventDefault()
    }
  }

  // While auth resolves (edit mode) or a locked invoice redirects away, hold on
  // the spinner so the editable form never flashes before the lock decision.
  const blocked = isEdit && (authLoading || (loadedStatus !== null && !canEditInvoice({ status: loadedStatus, voided_at: loadedVoidedAt }, hasPermission)))

  if (blocked) {
    return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
  }

  return (
    <form className="w-full max-w-4xl space-y-6" onSubmit={onFormSubmit} onKeyDown={onFormKeyDown}>
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{isEdit ? 'Update invoice details and items' : 'Create and send to clinic'}</p>
        </div>
      </div>

      {isEdit && loadedStatus && loadedStatus !== 'draft' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          You&rsquo;re editing a <span className="font-semibold capitalize">{loadedStatus}</span> invoice. Changes affect a document that has already been sent.
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Clinic *</Label>
            <Combobox
              aria-label="Clinic"
              options={customers.map(c => ({ value: c.id, label: c.clinic_name, hint: c.contact_person ?? undefined }))}
              value={customerId || null}
              onChange={setCustomerId}
              placeholder="Select a clinic…"
              searchPlaceholder="Search clinics…"
              emptyText="No clinics match."
            />
          </div>

          {selectedCustomer && (
            <div className="rounded-md border border-gray-200 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowRecipient(s => !s)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-100/50 sm:items-center"
              >
                <span className="flex items-center gap-2 text-gray-700">
                  {showRecipient ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-medium">Recipient details (Bill To / Deliver To)</span>
                  {recipientDirty && !showRecipient && (
                    <span className="text-xs font-medium text-amber-600">Edited</span>
                  )}
                </span>
                {!showRecipient && (
                  <span className="hidden max-w-[260px] truncate text-xs text-gray-500 sm:inline">
                    {billToName || 'No bill-to name'}
                  </span>
                )}
              </button>
              {showRecipient && (
                <div className="border-t border-gray-200 p-3 space-y-4">
                  {/* Bill To */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Bill To</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Clinic</Label>
                        <Input className="bg-white" value={billToName} onChange={e => setBillToName(e.target.value)} placeholder="Clinic name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Contact person</Label>
                        <Input className="bg-white" value={billToContact} onChange={e => setBillToContact(e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Phone</Label>
                        <PhoneInput value={billToPhone} onChange={setBillToPhone} />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Address</Label>
                        <Textarea className="bg-white" value={billingAddress} onChange={e => setBillingAddress(e.target.value)} rows={2} placeholder="Billing address" />
                      </div>
                    </div>
                  </div>

                  {/* Deliver To — auto-filled from the clinic, overridable per invoice.
                      The printed document shows a separate Deliver To column only when
                      these values differ from Bill To. */}
                  <div className="space-y-2 rounded-md border border-dashed border-gray-300 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Deliver To</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Clinic</Label>
                        <Input className="bg-white" value={shipToName} onChange={e => setShipToName(e.target.value)} placeholder="Clinic name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Contact person</Label>
                        <Input className="bg-white" value={shipToContact} onChange={e => setShipToContact(e.target.value)} placeholder="Optional" />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Address</Label>
                        <Textarea className="bg-white" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} rows={2} placeholder="Delivery address" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-gray-500">Edits apply to this invoice only.</p>
                    {recipientDirty && (
                      <Button type="button" variant="ghost" size="sm" onClick={restoreFromCustomer} className="h-7 w-full text-xs sm:w-auto">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore from clinic
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
          </div>

          {/* Patient / Doctor / Service Status — one grouped row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Patient *</Label>
              <Input placeholder="e.g. Tan Wei Ming" value={patient} onChange={e => setPatient(e.target.value)} aria-required />
            </div>
            <div className="space-y-2">
              <Label>Doctor *</Label>
              <Input placeholder="e.g. Dr. Lim Siew Hoon" value={doctor} onChange={e => setDoctor(e.target.value)} aria-required />
            </div>
            <div className="space-y-2">
              <Label>Service Status</Label>
              <Select
                value={serviceStatusId ?? '__none__'}
                onValueChange={v => setServiceStatusId(v === '__none__' ? null : v)}
              >
                <SelectTrigger
                  className={cn(
                    'h-10 w-full text-sm font-medium',
                    currentServiceStatus ? cn('border-transparent', currentServiceStatus.color ?? DEFAULT_COLOR) : '',
                  )}
                >
                  <SelectValue placeholder="No status set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No status</SelectItem>
                  {serviceStatuses.map(s => (
                    <ServiceStatusSelectItem key={s.id} status={s} />
                  ))}
                  <ManageOptionsLink href="/settings/service-statuses" label="Manage service statuses" />
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent ref={lineItemsRef} className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center">
              <p className="text-sm font-medium text-gray-500">No items yet</p>
              <p className="mx-auto mt-0.5 max-w-xs text-xs text-gray-400">
                Add products from your catalogue to build this invoice.
              </p>
              <div className="mt-4 w-full">
                <ProductSearchAdd products={products} onAdd={addProduct} />
              </div>
            </div>
          ) : (
            <>
              {/* Column header */}
              <div className="hidden items-center gap-3 px-3 text-[11px] font-medium uppercase tracking-wide text-gray-400 sm:flex">
                <span className="flex-1">Item</span>
                <span className="w-12 text-center">Qty</span>
                <span className="w-7" />
                <span className="w-24 text-right">Unit price</span>
                <span className="w-7" />
                <span className="w-20 text-right">Amount</span>
                <span className="w-8" />
              </div>

              <div className="space-y-1.5">
                {items.map((item, i) => {
                  const product = item.product_id ? products.find(p => p.id === item.product_id) : null
                  const hasRange = product?.min_unit_price != null && product?.max_unit_price != null
                  // A catalog product with no min/max range is a fixed-price item: price is locked.
                  const isFixed = product != null && !hasRange
                  const priceError = itemPriceErrors[i]
                  const lineTotal = item.quantity * item.unit_price
                  return (
                    <div
                      key={item.id ?? `new-${i}`}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-colors hover:border-gray-300"
                    >
                      {/* Money row — the catalogue product is the anchor */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                        <div className="min-w-0 flex-1">
                          {product ? (
                            <div className="flex h-9 items-center gap-2">
                              <span className="truncate text-sm font-semibold text-gray-900">{product.name}</span>
                              <span className="shrink-0 text-xs text-gray-400">/{product.unit}</span>
                            </div>
                          ) : (
                            <Input
                              className="h-9"
                              value={item.description}
                              placeholder="Custom item"
                              onChange={e => updateItem(i, 'description', e.target.value)}
                              aria-label="Item description"
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-[3.25rem_0.75rem_minmax(5.5rem,1fr)_0.75rem_minmax(5rem,auto)_2rem] items-start gap-2 sm:flex sm:gap-3">
                          <Input
                            className={cn('h-9 w-full px-1 text-center sm:w-12', noSpin)}
                            type="number"
                            inputMode="numeric"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={e => updateItem(i, 'quantity', Math.max(1, Math.floor(parseFloat(e.target.value) || 1)))}
                            aria-label="Quantity"
                          />
                          <span className="flex h-9 shrink-0 items-center justify-center text-xs text-gray-300 sm:w-7">×</span>

                          <div className="w-full sm:w-24">
                            {isFixed ? (
                              <div className="flex h-9 w-full items-center justify-end text-sm text-gray-500">
                                {formatCurrency(item.unit_price)}
                              </div>
                            ) : (
                              <>
                                <Input
                                  className={cn('h-9 w-full text-right', noSpin, priceError && 'border-destructive focus-visible:ring-destructive')}
                                  type="number"
                                  inputMode="decimal"
                                  min={hasRange ? product!.min_unit_price! : 0}
                                  max={hasRange ? product!.max_unit_price! : undefined}
                                  step="0.01"
                                  value={item.unit_price}
                                  aria-invalid={priceError ? true : undefined}
                                  onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                                  aria-label="Unit price"
                                />
                                {priceError ? (
                                  <p className="mt-1 text-right text-xs leading-tight text-destructive">{priceError}</p>
                                ) : hasRange ? (
                                  <p className="mt-1 text-right text-xs leading-tight text-gray-400">
                                    {formatPriceRange(product!.min_unit_price!, product!.max_unit_price!)}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </div>
                          <span className="flex h-9 shrink-0 items-center justify-center text-xs text-gray-300 sm:w-7">=</span>

                          <span className="flex h-9 shrink-0 items-center justify-end text-right text-sm font-semibold text-gray-900 sm:w-20">
                            {formatCurrency(lineTotal)}
                          </span>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-8 shrink-0 text-gray-300 hover:text-red-500"
                            onClick={() => removeItem(i)}
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Secondary, de-emphasised: editable printed description for catalogue products */}
                      {product && (
                        <div className="mt-1.5 pr-9">
                          <input
                            className="w-full min-w-0 bg-transparent text-xs text-gray-500 outline-none placeholder:text-gray-300"
                            value={item.description}
                            placeholder="Printed description"
                            onChange={e => updateItem(i, 'description', e.target.value)}
                            aria-label="Printed description"
                          />
                        </div>
                      )}

                    </div>
                  )
                })}
              </div>

              <ProductSearchAdd products={products} onAdd={addProduct} />

              <div className="flex justify-end border-t border-gray-200 pt-3">
                <div className="w-full space-y-1.5 sm:w-64">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-gray-500">Subtotal</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-gray-200 pt-1.5">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="text-lg font-semibold text-gray-900">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remarks</CardTitle>
          <p className="text-xs text-gray-500">Internal only — not printed or shown to the clinic.</p>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Internal remarks for this invoice…"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        {isEdit ? (
          // type="submit" → Enter in a header field saves; the form's onSubmit is
          // the single save path (no onClick, so a click can't double-fire it).
          <Button className="w-full sm:w-auto" type="submit" disabled={saving || hasItemPriceErrors}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        ) : (
          <>
            <Button className="w-full sm:w-auto" type="submit" disabled={saving || hasItemPriceErrors}>
              {saving ? 'Saving…' : 'Create'}
            </Button>
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => handleCreate('draft')} disabled={saving || hasItemPriceErrors}>
              Save as Draft
            </Button>
          </>
        )}
        <Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>Cancel</Button>
      </div>
    </form>
  )
}
