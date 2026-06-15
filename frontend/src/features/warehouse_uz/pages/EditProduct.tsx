import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/shared/api/client'
import type { Product } from '@/shared/types'
import { Header, ListSkeleton, EmptyState, IconBox } from '@/shared/ui'
import ProductDetailsForm from '../components/ProductDetailsForm'

export default function EditProduct() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const productId = Number(id)

  const { data: products, isLoading } = useQuery({
    queryKey: ['warehouse-uz-products'],
    queryFn: () => client.get<Product[]>('/warehouse-uz/products').then((r) => r.data),
  })

  const product = products?.find((p) => p.id === productId)

  return (
    <div className="min-h-screen pb-32 animate-fade-in">
      <Header title={t('Tahrirlash')} subtitle={product?.name ?? t('Mahsulot')} showBack />

      {isLoading ? (
        <ListSkeleton />
      ) : !product ? (
        <EmptyState icon={<IconBox size={30} />} title={t('Mahsulot topilmadi')} />
      ) : (
        <>
          <div className="px-4 pt-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg shrink-0">📦</div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{product.name}</p>
                <p className="text-xs font-mono text-slate-400">{product.barcode}</p>
              </div>
            </div>
          </div>
          <ProductDetailsForm
            productId={product.id}
            initial={product}
            submitLabel={t('Saqlash')}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['warehouse-uz-products'] })
              qc.invalidateQueries({ queryKey: ['warehouse-uz-stats'] })
              navigate('/warehouse-uz/products')
            }}
          />
        </>
      )}
    </div>
  )
}
