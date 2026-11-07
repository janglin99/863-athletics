import { createClient } from "@/lib/supabase/server"

// Shop and order endpoints are open to admins and to shop managers (a role
// limited to the shop settings and orders pages).
export async function requireShopAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized", status: 401 as const }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile || !["admin", "shop_manager"].includes(profile.role)) {
    return { error: "Forbidden", status: 403 as const }
  }
  return { userId: user.id }
}
