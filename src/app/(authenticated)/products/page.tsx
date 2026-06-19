import { getProducts } from '@/data/products'
import { ProductsClient } from '@/components/products/ProductsClient'

export default async function ProductsPage() {
  const products = await getProducts()
  return <ProductsClient products={products} />
}
