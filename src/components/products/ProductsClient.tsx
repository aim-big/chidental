'use client'

import { useState } from 'react'
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Combobox } from '@/components/ui/combobox'
import { formatCurrency } from '@/lib/utils'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Product } from '@/lib/database.types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/feedback/toast'
import type { ProductInput } from '@/domain/schemas'
import { createProductAction, updateProductAction, toggleProductActiveAction } from '@/data/product-actions'

// Common dental-lab units (stored as bare nouns; rendered as "per {unit}").
// The combobox still accepts a custom typed value.
const UNIT_OPTIONS = ['unit', 'tooth', 'arch', 'quadrant', 'case', 'set', 'pair']

// Client island for the products catalogue. The Server Component
// (`products/page.tsx`) fetches the rows via `getProducts` and passes them in;
// this component owns the create/edit dialog and the price-range toggle, and
// writes through the permission-gated Server Actions (which revalidate the list).
//
// The form schema (with the `use_price_range` UI toggle + numeric coercion) is
// client-only; the action re-validates a clean payload with `productInputSchema`.
const optionalPrice = z.preprocess(
  v => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0, 'Must be 0 or more').optional(),
)

const schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    use_price_range: z.boolean(),
    unit_price: optionalPrice,
    min_unit_price: optionalPrice,
    max_unit_price: optionalPrice,
    unit: z.string().min(1, 'Unit is required'),
  })
  .superRefine((data, ctx) => {
    if (data.use_price_range) {
      if (data.min_unit_price === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['min_unit_price'], message: 'Required' })
      }
      if (data.max_unit_price === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['max_unit_price'], message: 'Required' })
      }
      if (
        data.min_unit_price !== undefined &&
        data.max_unit_price !== undefined &&
        data.min_unit_price > data.max_unit_price
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['max_unit_price'], message: 'Max must be ≥ min' })
      }
    } else if (data.unit_price === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unit_price'], message: 'Price is required' })
    }
  })
type FormData = z.infer<typeof schema>

export function ProductsClient({ products }: { products: Product[] }) {
  const { hasPermission } = useAuth()
  const { show } = useToast()
  const canEdit = hasPermission('products.edit')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    // zod's `coerce.number()` types the resolver input as `unknown`; cast to the
    // form's value type so RHF's Resolver generics line up.
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { unit: 'unit', unit_price: 0, use_price_range: false },
  })
  const usePriceRange = useWatch({ control, name: 'use_price_range' })

  const openNew = () => {
    setEditing(null)
    reset({
      name: '',
      description: '',
      use_price_range: false,
      unit_price: 0,
      min_unit_price: undefined,
      max_unit_price: undefined,
      unit: 'unit',
    })
    setOpen(true)
  }

  const openEdit = (p: Product) => {
    const hasRange = p.min_unit_price != null && p.max_unit_price != null
    setEditing(p)
    reset({
      name: p.name,
      description: p.description ?? '',
      use_price_range: hasRange,
      unit_price: hasRange ? undefined : p.unit_price,
      min_unit_price: p.min_unit_price ?? undefined,
      max_unit_price: p.max_unit_price ?? undefined,
      unit: p.unit,
    })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    if (!canEdit) return
    setSaving(true)
    const rangeMode = data.use_price_range
    const payload: ProductInput = {
      name: data.name,
      description: data.description || null,
      unit_price: rangeMode ? (data.min_unit_price as number) : (data.unit_price as number),
      unit: data.unit,
      min_unit_price: rangeMode ? (data.min_unit_price as number) : null,
      max_unit_price: rangeMode ? (data.max_unit_price as number) : null,
    }

    const result = editing
      ? await updateProductAction(editing.id, payload)
      : await createProductAction(payload)

    if (result.ok === false) {
      show({ variant: 'error', title: result.error })
      setSaving(false)
      return
    }
    show({ variant: 'success', title: editing ? 'Product updated' : 'Product added' })
    setSaving(false)
    setOpen(false)
  }

  const toggleActive = async (p: Product) => {
    const result = await toggleProductActiveAction(p.id, !p.active)
    if (result.ok === false) {
      show({ variant: 'error', title: result.error })
      return
    }
    show({ variant: 'success', title: p.active ? 'Product deactivated' : 'Product activated' })
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products & Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">Price catalog for invoicing</p>
        </div>
        {canEdit && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Product</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No products yet</TableCell></TableRow>}
              {products.map(p => (
                <TableRow key={p.id} className={p.active ? '' : 'opacity-50'}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{p.description ?? '—'}</TableCell>
                  <TableCell className="text-gray-500 text-sm">per {p.unit}</TableCell>
                  <TableCell className="font-medium">
                    {p.min_unit_price != null && p.max_unit_price != null
                      ? `${formatCurrency(p.min_unit_price)} – ${formatCurrency(p.max_unit_price)}`
                      : formatCurrency(p.unit_price)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? 'success' : 'secondary'}>{p.active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit product" onClick={() => openEdit(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit product</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={p.active ? 'Deactivate product' : 'Activate product'}
                              onClick={() => toggleActive(p)}
                            >
                              {p.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {p.active ? 'Active — click to deactivate (hides from new invoices)' : 'Inactive — click to activate'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Product' : 'New Product / Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. Zirconia Crown" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Short description…" rows={2} {...register('description')} />
            </div>
            {!usePriceRange ? (
              <div className="space-y-2">
                <Label>Price (MYR) *</Label>
                <Input type="number" step="0.01" min="0" {...register('unit_price')} />
                {errors.unit_price && <p className="text-xs text-destructive">{errors.unit_price.message}</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min price (MYR) *</Label>
                  <Input type="number" step="0.01" min="0" {...register('min_unit_price')} />
                  {errors.min_unit_price && <p className="text-xs text-destructive">{errors.min_unit_price.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Max price (MYR) *</Label>
                  <Input type="number" step="0.01" min="0" {...register('max_unit_price')} />
                  {errors.max_unit_price && <p className="text-xs text-destructive">{errors.max_unit_price.message}</p>}
                </div>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 mt-0.5 rounded border-gray-300"
                {...register('use_price_range')}
              />
              <span>
                Enable price range
                <span className="block text-xs text-gray-400 font-normal">Lets invoices use any price between a min and a max for this product.</span>
              </span>
            </label>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">per</span>
                <div className="flex-1">
                  <Controller
                    control={control}
                    name="unit"
                    render={({ field }) => (
                      <Combobox
                        value={field.value}
                        onChange={field.onChange}
                        options={UNIT_OPTIONS}
                        placeholder="unit"
                      />
                    )}
                  />
                </div>
              </div>
              {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
