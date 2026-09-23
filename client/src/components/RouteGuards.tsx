import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { homeForRole, useAuth } from '../store/auth';
import type { Role } from '../lib/types';
import { EmptyState, Spinner } from './ui';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!user) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-forest-600">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuth((state) => state.user);

  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          title="This area is for another kind of account"
          body={`You are signed in as ${user.name} (${user.role.toLowerCase()}). Switch to the app that matches your role.`}
          action={
            <a className="btn btn-primary" href={homeForRole(user.role)}>
              Go to my app
            </a>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
