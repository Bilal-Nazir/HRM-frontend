import { NextRequest, NextResponse } from "next/server";
import { taskReturnPath } from "@/lib/taskLinks";

const employeePages = [
  "/dashboard",
  "/employees",
  "/projects",
  "/attendance",
  "/leave",
  "/announcements",
  "/terms",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accountType = request.cookies.get("hrm_account_type")?.value;
  if (pathname === "/" && accountType) {
    return NextResponse.redirect(new URL(accountType === "admin" ? "/admin/dashboard" : "/dashboard", request.url));
  }
  const isAdminPage = pathname.startsWith("/admin/") && pathname !== "/admin/login";
  const isEmployeePage = employeePages.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );

  if (isAdminPage && accountType === "employee") {
    return NextResponse.redirect(new URL(taskReturnPath(`${pathname}${request.nextUrl.search}`, false) || "/dashboard", request.url));
  }
  if (isEmployeePage && accountType === "admin") {
    return NextResponse.redirect(new URL(taskReturnPath(`${pathname}${request.nextUrl.search}`, true) || "/admin/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/dashboard/:path*",
    "/employees/:path*",
    "/projects/:path*",
    "/attendance/:path*",
    "/leave/:path*",
    "/announcements/:path*",
    "/terms/:path*",
    "/settings/:path*",
  ],
};
