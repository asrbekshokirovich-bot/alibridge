import { useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/Button';
import { EmptyState } from '@shared/components/EmptyState';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="p-4">
      <EmptyState
        icon="🔍"
        title="Sahifa topilmadi"
        description="Bunday sahifa mavjud emas yoki o'chirilgan"
        action={<Button onClick={() => navigate('/')}>Bosh sahifa</Button>}
      />
    </div>
  );
}
