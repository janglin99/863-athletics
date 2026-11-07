import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

const PORTAL_ROUTES = ["/dashboard", "/book", "/bookings", "/profile", "/payments"]
const ADMIN_ROUTES = ["/admin"]
const SHOP_MANAGER_ROUTES = ["/admin/shop", "/admin/orders"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users from portal
  if (!user && PORTAL_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(
      new URL(`/login?next=${pathname}`, request.url)
    )
  }

  // Redirect unauthenticated users from admin
  if (!user && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Check admin role for admin routes
  if (user && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (
      !profile ||
      !["admin", "staff", "shop_manager"].includes(profile.role)
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Shop managers may only use the shop and orders pages.
    if (
      profile.role === "shop_manager" &&
      !SHOP_MANAGER_ROUTES.some(
        (r) => pathname === r || pathname.startsWith(`${r}/`)
      )
    ) {
      return NextResponse.redirect(new URL("/admin/orders", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|images).*)",
  ],
}
