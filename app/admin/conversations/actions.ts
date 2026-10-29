"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteConversation } from "@/lib/supabase-admin";

export async function deleteConversationAction(id: string, redirectTo?: string) {
  if (typeof id !== "string" || !id) return;

  await deleteConversation(id);
  revalidatePath("/admin/conversations");

  if (redirectTo) {
    redirect(redirectTo);
  }
}
