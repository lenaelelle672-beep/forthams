import ForbiddenPage from '@/pages/ForbiddenPage';
import { useAuth, type AuthUser } from '@/context/AuthContext';

function canViewWorkflowDefinitionPreview(user: AuthUser | null) {
  if (!user) return true;

  const roles = user.roles ?? [];
  if (roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role.toUpperCase()))) {
    return true;
  }

  const permissions = user.permissions ?? [];
  if (permissions.length === 0) return true;

  return permissions.includes('*')
    || permissions.includes('*:*:*')
    || permissions.includes('workflow:definition:query')
    || permissions.includes('workflow:definition:edit');
}

export default function WorkflowDefinitionV2Page() {
  const { user } = useAuth();

  if (!canViewWorkflowDefinitionPreview(user)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      <iframe
        title="流程定义 2"
        src="/stitch/workflows-v2/index.html"
        className="h-full w-full border-0"
      />
    </div>
  );
}
