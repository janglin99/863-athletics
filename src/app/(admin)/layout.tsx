import { AdminSidebar } from "@/components/layout/AdminSidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
