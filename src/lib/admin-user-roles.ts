import { db } from "@/integrations/supabase/untyped";

export async function setAdminManagedUserRoles(targetUserId: string, roles: readonly string[]) {
  const { error } = await db.rpc("admin_set_user_roles", {
    p_target_user_id: targetUserId,
    p_roles: [...new Set(roles)].sort(),
  });
  if (error) throw error;
}

export function adminRoleErrorMessage(error: unknown): string {
  const message = typeof error === "object" && error && "message" in error
    ? String(error.message)
    : String(error ?? "");
  if (message.includes("LAST_ADMIN_PROTECTED")) return "Não é possível remover o último administrador da plataforma.";
  if (message.includes("RECENT_AUTH_REQUIRED")) return "Sua autenticação expirou para esta ação crítica. Entre novamente e tente de novo.";
  return "Não foi possível atualizar as permissões.";
}
