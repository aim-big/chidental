import { Controller, Get, Query } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

// Read endpoints for the products module (strangler migration, module 1).
// Any authenticated user may read the catalogue (mirrors the web RLS: the
// products_read policy allows all authenticated sessions), so no
// @RequirePermission here — the global guard's valid-session check is the gate.
const SORT_COLUMNS: Record<string, string> = { name: 'name', unit: 'unit', price: 'unit_price' }

@Controller('products')
export class ProductsController {
  constructor(private readonly supabase: SupabaseService) {}

  // Mirrors apps/web getProducts(): all products (active + inactive), name asc.
  @Get()
  async list() {
    const { data, error } = await this.supabase.admin.from('products').select('*').order('name')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Mirrors apps/web getActiveUnits(): active units for the product form dropdown.
  @Get('units')
  async units() {
    const { data, error } = await this.supabase.admin
      .from('units')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Mirrors apps/web getProductsPage(): server-side view filter + search + sort +
  // pagination via .order().range() with an exact count. Same shape as ProductListPage.
  @Get('page')
  async page(
    @Query('q') q = '',
    @Query('view') view: 'active' | 'inactive' | 'all' = 'active',
    @Query('page') pageRaw = '1',
    @Query('pageSize') pageSizeRaw = '10',
    @Query('sort') sort: string | null = null,
    @Query('dir') dir: 'asc' | 'desc' = 'asc',
  ) {
    const pageSize = Math.max(1, Number(pageSizeRaw) || 10)
    const page = Math.max(1, Number(pageRaw) || 1)
    const sortCol = (sort && SORT_COLUMNS[sort]) || 'name'

    let query = this.supabase.admin
      .from('products')
      .select('*', { count: 'exact' })
      .order(sortCol, { ascending: dir !== 'desc' })

    if (view === 'active') query = query.eq('active', true)
    else if (view === 'inactive') query = query.eq('active', false)

    const term = q.trim()
    if (term) {
      const safe = term.replace(/[%,]/g, ' ')
      query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,unit.ilike.%${safe}%`)
    }

    const from = (page - 1) * pageSize
    const { data, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)

    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const rows = data ?? []
    return {
      rows,
      total,
      page: Math.min(page, totalPages),
      totalPages,
      pageStart: total === 0 ? 0 : from + 1,
      pageEnd: from + rows.length,
    }
  }
}
