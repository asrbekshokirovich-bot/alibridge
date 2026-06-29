import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ReceiveChecklist } from '@/shared/ui'

export default function ReceiveFromCarrier() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <ReceiveChecklist
      title={t("Yo'lovchidan qabul")}
      groupNoun={t("Yo'lovchi")}
      groupsUrl="/warehouse-tr/receive-groups"
      confirmUrl="/warehouse-tr/confirm-receive"
      queryKey="warehouse-tr-receive-groups"
      buttonLabel={t('Qabul qildim')}
      successTitle={t('Qabul qilindi!')}
      successDesc={() => t('Yuk omborga olindi.')}
      invalidateKeys={['warehouse-tr-incoming', 'warehouse-tr-held']}
      onBack={() => navigate('/warehouse-tr')}
    />
  )
}
