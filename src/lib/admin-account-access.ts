import { db } from "@/integrations/supabase/untyped";

export type AdminAccountAction = "suspend" | "reactivate";

export async function changeAdminManagedAccountAccess(userId: string, action: AdminAccountAction) {
  const { data, error } = await db.functions.invoke("admin-account-access", {
    body: { user_id: userId, action },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "Account update failed");
  return data as { ok: true; status: "suspended" | "active"; notice: string };
}
