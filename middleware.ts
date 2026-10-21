import { NextRequest, NextResponse } from "next/server";

const employeePages = [
  "/dashboard",
  "/employees",
  "/attendance",
  "/leave",
  "/announcements",
  "/terms",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accountType = request.cookies.get("hrm_account_type")?.value;
  const isAdminPage = pathname.startsWith("/admin/") && pathname !== "/admin/login";
  const isEmployeePage = employeePages.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );

  if (isAdminPage && accountType === "employee") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isEmployeePage && accountType === "admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/employees/:path*",
    "/attendance/:path*",
    "/leave/:path*",
    "/announcements/:path*",
    "/terms/:path*",
    "/settings/:path*",
  ],
};
