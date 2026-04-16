import { Dumbbell } from "lucide-react"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-4">
      <Link
        href="/"
        className="flex items-center gap-2 mb-8"
      >
        <Dumbbell className="h-8 w-8 text-brand-orange" />
        <span className="text-2xl font-display font-bold uppercase tracking-wide">
          863 Athletics
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
