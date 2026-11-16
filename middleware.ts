import { NextRequest, NextResponse } from "next/server";
import { taskReturnPath } from "@/lib/taskLinks";
<<<<<<< HEAD
import { dashboardHref, isAccountPath, loginHref, protectedPortal } from "@/lib/authRoutes";
=======

const employeePages = [
  "/dashboard",
  "/employees",
  "/projects",
  "/attendance",
  "/leave",
  "/chat",
  "/announcements",
  "/terms",
  "/settings",
];
>>>>>>> prod

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookie = request.cookies.get("hrm_account_type")?.value;
  const accountType = cookie === "admin" || cookie === "employee" ? cookie : null;
  if ((pathname === "/" || pathname === "/admin") && accountType) {
    return NextResponse.redirect(new URL(dashboardHref(accountType), request.url));
  }
  const portal = protectedPortal(pathname);
  // This cookie is only a routing hint. AuthGuard verifies the actual token.
  if ((portal || isAccountPath(pathname)) && !accountType) {
    return NextResponse.redirect(new URL(loginHref(pathname, request.nextUrl.search), request.url));
  }
  if (portal && accountType && portal !== accountType) {
    return NextResponse.redirect(new URL(taskReturnPath(`${pathname}${request.nextUrl.search}`, accountType === "admin") || dashboardHref(accountType), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/companies",
    "/join",
    "/admin/:path*",
    "/dashboard/:path*",
    "/employees/:path*",
    "/projects/:path*",
    "/attendance/:path*",
    "/leave/:path*",
    "/chat/:path*",
    "/announcements/:path*",
    "/terms/:path*",
    "/settings/:path*",
  ],
};
