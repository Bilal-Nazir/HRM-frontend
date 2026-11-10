import { ApiError } from "@/lib/api";
import { SessionUser } from "@/lib/auth";

export const canManageContent = (user: SessionUser | null) =>
  !!user?.permissions?.some(
    (value) => value === "*" || value === "organization.update",
  );

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const details = Object.values(error.data).filter(
      (value) => typeof value === "string",
    );
    return details.length ? details.join(". ") : error.message;
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export { AttendanceLocationError, captureAttendanceLocation } from "@/lib/attendanceGeolocation";
