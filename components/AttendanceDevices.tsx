import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { AttendanceDevice } from "@/types";

function DeviceSnapshot({ device, label, pending }: { device?: AttendanceDevice; label: string; pending?: boolean }) {
  if (!device) return <section><h4>{label}</h4><p>{pending ? "Awaiting check-out" : "Device information not recorded"}</p></section>;
  const fields = [
    ["Device type", device.deviceType], ["Browser", [device.browser, device.browserVersion].filter(Boolean).join(" ")],
    ["Reported OS", [device.os, device.osVersion].filter(Boolean).join(" ")], ["Model", device.model || "Not provided by browser"],
    ["Platform", device.platform], ["Platform version hint", device.platformVersion], ["Architecture", [device.architecture, device.bitness && `${device.bitness}-bit`].filter(Boolean).join(" · ")],
    ["Public internet IP", device.publicIpAddress || "Not captured for this session"],
    ["Request IP", device.ipAddress || "Not available"], ["Proxy / server connection IP", device.connectionIp && device.connectionIp !== device.ipAddress ? device.connectionIp : undefined],
    ["Time zone", device.timezone], ["Language", device.language],
    ["Screen", device.screenWidth && device.screenHeight ? `${device.screenWidth} × ${device.screenHeight} CSS px` : undefined],
    ["Viewport", device.viewportWidth && device.viewportHeight ? `${device.viewportWidth} × ${device.viewportHeight} CSS px` : undefined],
    ["Pixel ratio", device.pixelRatio], ["Touch points", device.touchPoints], ["Logical processors (reported)", device.logicalProcessors], ["Memory (approximate)", device.memoryGB ? `${device.memoryGB} GB` : undefined],
    ["Recorded", new Date(device.capturedAt).toLocaleString([], { hour12: true })],
    ["MAC address", "Unavailable in web browsers"], ["User agent", device.userAgent],
  ];
  return <section><h4>{label}</h4><dl>{fields.filter(([, value]) => value !== undefined && value !== "").map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></section>;
}

export default function AttendanceDevices({ checkIn, checkOut, completed = false }: { checkIn?: AttendanceDevice; checkOut?: AttendanceDevice; completed?: boolean }) {
  if (!checkIn && !checkOut) return <span className="attendance-device-missing">Not recorded</span>;
  const current = checkIn || checkOut!;
  const Icon = current.deviceType === "mobile" ? Smartphone : current.deviceType === "tablet" ? Tablet : Monitor;
  return <details className="attendance-device-details"><summary><Icon size={16}/><span><strong>{current.deviceType === "unknown" ? "Device" : current.deviceType} · {current.os || "Unknown OS"}</strong><small>{current.browser || "Unknown browser"} · View details</small></span></summary><div className="attendance-device-content"><DeviceSnapshot label="Check-in device" device={checkIn}/><DeviceSnapshot label="Check-out device" device={checkOut} pending={!completed}/><p className="attendance-device-note">Browser-reported details can be limited or changed. They do not identify verified hardware; request IP may belong to a proxy or VPN.</p></div></details>;
}
