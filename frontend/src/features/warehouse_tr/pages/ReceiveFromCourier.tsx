import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ReceiveChecklist } from '@/shared/ui'

export default function ReceiveFromCourier() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <ReceiveChecklist
      title={t('Kuryerdan qabul')}
      groupNoun={t('Kuryer')}
      groupsUrl="/warehouse-tr/receive-courier-groups"
      confirmUrl="/warehouse-tr/confirm-receive-courier"
      queryKey="warehouse-tr-receive-courier-groups"
      buttonLabel={t('Qabul qildim')}
      successTitle={t('Qabul qilindi!')}
      successDesc={() => t('Yuk omborga olindi.')}
      invalidateKeys={['warehouse-tr-incoming', 'warehouse-tr-held']}
      onBack={() => navigate('/warehouse-tr')}
    />
  )
}
