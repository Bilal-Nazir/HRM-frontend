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

export function captureAttendanceLocation() {
  return new Promise<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  }>((resolve, reject) => {
    if (!window.isSecureContext)
      return reject(
        new Error(
          "Location requires HTTPS or localhost. Open the secure site and retry.",
        ),
      );
    if (!navigator.geolocation)
      return reject(new Error("Location is not supported by this browser."));
    const requestLocation = (highAccuracy: boolean) =>
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          if (![latitude, longitude, accuracy].every(Number.isFinite))
            return reject(
              new Error(
                "The browser returned an invalid location. Please retry.",
              ),
            );
          resolve({ latitude, longitude, accuracyMeters: accuracy });
        },
        (error) => {
          // Laptops may not provide a high-accuracy fix; retry with a fresh standard fix.
          // Do not retry denied permission or invent coordinates.
          if (highAccuracy && (error.code === 2 || error.code === 3)) {
            requestLocation(false);
            return;
          }
          reject(
            new Error(
              error.code === 1
                ? "Location access is blocked. Allow Location in this site's browser settings and enable location services for your browser, then retry."
                : error.code === 3
                  ? "Location timed out. Check your device location services and connection, then retry."
                  : "Your device could not determine its location. Enable location services for your browser and retry.",
            ),
          );
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 15000 : 10000,
          maximumAge: 0,
        },
      );
    requestLocation(true);
  });
}
