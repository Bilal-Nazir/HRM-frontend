import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Backend data is fetched in the browser; no ISR storage resource is needed.
export default defineCloudflareConfig();
