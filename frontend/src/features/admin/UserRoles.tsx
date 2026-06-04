import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '@shared/api/client';
import { Card } from '@shared/components/Card';
import { Button } from '@shared/components/Button';
import { LoadingScreen } from '@shared/components/LoadingScreen';
import { useBackButton, haptic } from '@shared/hooks/useTelegram';

interface UserListItem {
  id: string;
  telegram_id: string;
  full_name: string;
  username: string | null;
  roles: string[];
  language: string;
  created_at: string;
}

const ALL_ROLES = [
  'orderer', 'china_worker', 'carrier', 'warehouse_uz', 'warehouse_tr',
  'courier_uz', 'courier_tr', 'admin',
];

export default function AdminUserRoles() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);

  useBackButton(() => {
    if (selectedUser) {
      setSelectedUser(null);
    } else {
      navigate(-1);
    }
  });

  const { data, isLoading } = useQuery<UserListItem[]>({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      const { data } = await api.get<UserListItem[]>(`/admin/users?q=${encodeURIComponent(search)}`);
      return data;
    },
  });

  const grantMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.post(`/admin/users/${userId}/roles`, { role });
    },
    onSuccess: () => {
      haptic('success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (selectedUser) {
        setSelectedUser((prev) =>
          prev ? { ...prev, roles: [...prev.roles, grantMutation.variables!.role] } : null
        );
      }
    },
    onError: (error) => {
      haptic('error');
      alert(extractErrorMessage(error));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.delete(`/admin/users/${userId}/roles/${role}`);
    },
    onSuccess: () => {
      haptic('light');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (selectedUser) {
        setSelectedUser((prev) =>
          prev
            ? { ...prev, roles: prev.roles.filter((r) => r !== revokeMutation.variables!.role) }
            : null
        );
      }
    },
    onError: (error) => alert(extractErrorMessage(error)),
  });

  if (isLoading && !selectedUser) return <LoadingScreen />;

  // Foydalanuvchi tahrirlash
  if (selectedUser) {
    return (
      <div className="space-y-3 p-4 pb-20">
        <Card>
          <p className="font-bold">{selectedUser.full_name}</p>
          {selectedUser.username && (
            <p className="text-sm text-tg-hint">@{selectedUser.username}</p>
          )}
          <p className="text-xs text-tg-hint">ID: {selectedUser.telegram_id}</p>
        </Card>

        <p className="px-1 text-sm font-medium text-tg-hint">{t('admin.roles')}</p>

        {ALL_ROLES.map((role) => {
          const hasRole = selectedUser.roles.includes(role);
          return (
            <Card key={role} className="py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t(`roles.${role}`, { defaultValue: role })}</span>
                <Button
                  size="sm"
                  variant={hasRole ? 'destructive' : 'primary'}
                  onClick={() => {
                    if (hasRole) {
                      revokeMutation.mutate({ userId: selectedUser.id, role });
                    } else {
                      grantMutation.mutate({ userId: selectedUser.id, role });
                    }
                  }}
                >
                  {hasRole ? t('admin.revoke') : t('admin.grant')}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // Foydalanuvchilar ro'yxati
  return (
    <div className="space-y-3 p-4 pb-20">
      <h2 className="px-1 text-lg font-bold">{t('admin.users')}</h2>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('admin.search_users')}
        className="w-full rounded-xl border border-tg-secondary-bg bg-tg-secondary-bg px-4 py-2.5 text-sm text-tg-text outline-none focus:border-tg-button"
      />

      {data?.map((user) => (
        <Card
          key={user.id}
          className="cursor-pointer active:scale-95"
          onClick={() => setSelectedUser(user)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{user.full_name}</p>
              {user.username && <p className="text-xs text-tg-hint">@{user.username}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded bg-tg-secondary-bg px-1.5 py-0.5 text-xs"
                  >
                    {t(`roles.${role}`, { defaultValue: role })}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-tg-button">→</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
