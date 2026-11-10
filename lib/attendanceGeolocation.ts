export class AttendanceLocationError extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message);
    this.name = "AttendanceLocationError";
  }
}

export type AttendanceCoordinates = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  locationCapturedAt: string;
};

// Wait for a fresh update instead of giving up on the first unavailable result.
export function captureAttendanceLocation(): Promise<AttendanceCoordinates> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext)
      return reject(
        new AttendanceLocationError(
          "Location requires HTTPS or localhost. Open the secure site and retry.",
          0,
        ),
      );
    if (!navigator.geolocation)
      return reject(
        new AttendanceLocationError(
          "Location is not supported by this browser. Open the app on your phone or send a location pin for admin review.",
          0,
        ),
      );
    const geo = navigator.geolocation;
    const startedAt = Date.now();
    let done = false,
      watch: number | null = null,
      timer: ReturnType<typeof setTimeout> | undefined;
    let phase: "high" | "standard" = "high";
    let best: AttendanceCoordinates | null = null;
    const clear = () => {
      if (timer) clearTimeout(timer);
      if (watch !== null) {
        geo.clearWatch(watch);
        watch = null;
      }
    };
    const succeed = (point: AttendanceCoordinates) => {
      if (done) return;
      done = true;
      clear();
      resolve(point);
    };
    const fail = (code: number) => {
      if (done) return;
      done = true;
      clear();
      reject(
        new AttendanceLocationError(
          code === 1
            ? "Location access is blocked. Allow this site and your browser to use Location Services, then retry."
            : code === 3
              ? "Finding your location timed out. Retry, open this app directly on your phone, or send a map pin for admin review."
              : "Your browser could not locate this device. Open this app directly on your phone or send your location pin for admin review.",
          code,
        ),
      );
    };
    const point = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      const stamp = position.timestamp;
      if (
        ![latitude, longitude, accuracy, stamp].every(Number.isFinite) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        accuracy < 0 ||
        stamp < startedAt - 5000 ||
        stamp > Date.now() + 5000
      )
        return null;
      return {
        latitude,
        longitude,
        accuracyMeters: accuracy,
        locationCapturedAt: new Date(stamp).toISOString(),
      };
    };
    const standard = () => {
      if (done || phase === "standard") return;
      phase = "standard";
      clear();
      timer = setTimeout(() => fail(3), 11000);
      geo.getCurrentPosition(
        (position) => {
          const value = point(position);
          if (value) succeed(value);
          else fail(2);
        },
        (error) => fail(error.code),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      );
    };
    const finishHigh = () => {
      if (best) succeed(best);
      else standard();
    };
    timer = setTimeout(finishHigh, 20000);
    if (typeof geo.watchPosition === "function") {
      const id = geo.watchPosition(
        (position) => {
          const value = point(position);
          if (done || phase !== "high" || !value) return;
          if (!best || value.accuracyMeters < best.accuracyMeters) best = value;
          if (best.accuracyMeters <= 100) succeed(best);
        },
        (error) => {
          if (phase === "high" && error.code === 1) fail(1);
        },
        { enableHighAccuracy: true, timeout: 18000, maximumAge: 0 },
      );
      watch = id;
      if (done) clear();
    } else {
      geo.getCurrentPosition(
        (position) => {
          if (done || phase !== "high") return;
          const value = point(position);
          if (value) succeed(value);
          else standard();
        },
        (error) => {
          if (phase === "high") error.code === 1 ? fail(1) : standard();
        },
        { enableHighAccuracy: true, timeout: 18000, maximumAge: 0 },
      );
    }
  });
}

export function parseLocationPin(
  value: string,
): { latitude: number; longitude: number } | null {
  let pair = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!pair) {
    try {
      const url = new URL(value.trim());
      if (
        url.protocol !== "https:" ||
        !/(^|\.)(google\.[a-z.]+|openstreetmap\.org)$/.test(url.hostname)
      )
        return null;
      const query =
        url.searchParams.get("q") || url.searchParams.get("query") || "";
      pair =
        query.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/) ||
        url.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ||
        url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (!pair && url.searchParams.has("mlat") && url.searchParams.has("mlon"))
        pair =
          `${url.searchParams.get("mlat")},${url.searchParams.get("mlon")}`.match(
            /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/,
          );
    } catch {
      return null;
    }
  }
  if (!pair) return null;
  const latitude = Number(pair[1]),
    longitude = Number(pair[2]);
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}
