import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { AdminMobileNav } from "@/components/layout/AdminMobileNav"
import { createClient } from "@/lib/supabase/server"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Shop managers only see the Shop and Orders links.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null }
  const shopOnly = profile?.role === "shop_manager"

  return (
    <div className="flex h-screen bg-bg-primary">
      <AdminSidebar shopOnly={shopOnly} />
      <AdminMobileNav shopOnly={shopOnly} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
