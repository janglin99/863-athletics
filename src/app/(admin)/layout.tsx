import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { AdminMobileNav } from "@/components/layout/AdminMobileNav"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-bg-primary">
      <AdminSidebar />
      <AdminMobileNav />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
