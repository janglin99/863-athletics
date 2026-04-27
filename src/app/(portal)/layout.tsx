import { PortalSidebar } from "@/components/layout/PortalSidebar"
import { MobileNav } from "@/components/layout/MobileNav"
import { FloatingCartButton } from "@/components/cart/FloatingCartButton"
import { ChatWidget } from "@/components/chat/ChatWidget"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      <PortalSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 overflow-x-hidden">
        {children}
      </main>
      <FloatingCartButton />
      <MobileNav />
      <ChatWidget />
    </div>
  )
}
