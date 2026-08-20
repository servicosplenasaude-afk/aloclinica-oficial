import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface AdminRouteGuardProps {
  children: ReactNode;
  roles: readonly string[];
}

/**
 * Explicit client-side boundary for every administrative screen.
 *
 * This is a UX/navigation guard. Database RLS and server-side authorization
 * remain the source of truth for administrative data and mutations.
 */
export function AdminRouteGuard({ children, roles }: AdminRouteGuardProps) {
  if (!roles.includes("admin")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default AdminRouteGuard;
