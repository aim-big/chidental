import { getProducts, getActiveUnits } from '@/data/products'
import { ProductsClient } from '@/components/products/ProductsClient'

export default async function ProductsPage() {
  const [products, units] = await Promise.all([getProducts(), getActiveUnits()])
  return <ProductsClient products={products} units={units} />
}
