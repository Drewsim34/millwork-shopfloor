import { init } from "@instantdb/react";
import schema from "../instant.schema";

// Same InstantDB app/schema as the CRM + mobile app — this shop-floor app reads
// the production jobs/units that the CRM Production Scheduler writes. App ID is
// public (safe to expose); override via NEXT_PUBLIC_INSTANT_APP_ID if the shop
// ever moves to a different Instant app.
export const INSTANT_APP_ID =
  process.env.NEXT_PUBLIC_INSTANT_APP_ID ?? "4fd78e6c-5e05-4ffb-883b-5a7e3b246ff7";

export const idb = init({ appId: INSTANT_APP_ID, schema });

export type { AppSchema } from "../instant.schema";
