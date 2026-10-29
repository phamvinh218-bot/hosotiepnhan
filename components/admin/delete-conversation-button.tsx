"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteConversationAction } from "@/app/admin/conversations/actions";

export function DeleteConversationButton({
  id,
  redirectTo,
  label,
}: {
  id: string;
  redirectTo?: string;
  label?: string;
}) {
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      "Xóa vĩnh viễn cuộc hội thoại này? Toàn bộ tin nhắn bên trong cũng sẽ bị xóa và không thể khôi phục.",
    );
    if (!confirmed) return;

    startTransition(() => {
      deleteConversationAction(id, redirectTo);
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size={label ? "sm" : "icon-sm"}
      aria-label="Xóa cuộc hội thoại"
      disabled={pending}
      onClick={handleClick}
    >
      <Trash2 className="size-3.5" />
      {label && (pending ? "Đang xóa..." : label)}
    </Button>
  );
}
