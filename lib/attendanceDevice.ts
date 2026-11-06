type ClientHints = {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string; model?: string; architecture?: string; bitness?: string }>;
};

// Collection is best-effort and must never prevent attendance from being saved.
export async function captureAttendanceDevice() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return {};
  const nav = navigator as Navigator & { userAgentData?: ClientHints; deviceMemory?: number };
  const hints = nav.userAgentData;
  const base = {
    platform: hints?.platform || nav.platform,
    mobile: hints?.mobile,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: nav.language,
    screenWidth: window.screen?.width, screenHeight: window.screen?.height,
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, pixelRatio: window.devicePixelRatio,
    touchPoints: nav.maxTouchPoints, logicalProcessors: nav.hardwareConcurrency, memoryGB: nav.deviceMemory,
  };
  if (!hints?.getHighEntropyValues) return base;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const details = await Promise.race([
      hints.getHighEntropyValues(["platformVersion", "model", "architecture", "bitness"]),
      new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), 500); }),
    ]);
    return { ...base, platformVersion: details?.platformVersion, model: details?.model, architecture: details?.architecture, bitness: details?.bitness };
  } catch { return base; }
  finally { if (timeout) clearTimeout(timeout); }
}
