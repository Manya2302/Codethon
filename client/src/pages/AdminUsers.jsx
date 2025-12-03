import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import UserManagementTable from '@/components/UserManagementTable';

export default function AdminUsers() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    if (window.refreshUserTable) {
      window.refreshUserTable();
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-muted-foreground">View and manage all users in the system.</p>
          </div>
        </div>
        <UserManagementTable key={refreshKey} onRefresh={handleRefresh} />
      </div>
    </DashboardLayout>
  );
}

