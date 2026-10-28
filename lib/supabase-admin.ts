import "server-only";
import { createAdminClient } from "@supabase/server/core";

export function getSupabaseAdmin() {
  return createAdminClient();
}
