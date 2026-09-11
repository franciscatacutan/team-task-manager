import { useState } from "react";

import { useCreateTaskComment } from "../hooks/useCreateTaskComment";

import { Avatar, AvatarFallback } from "../../../components/ui/avatar";

import AutoResizeTextarea from "../../../common/components/AutoResizeTextareaForm";

interface Props {
  teamKey: string;
  projectKey: string;
  taskNumber: string;
}

export default function TaskUCommentForm({ teamKey, projectKey, taskNumber }: Props) {
  const [message, setMessage] = useState("");

  const createUpdate = useCreateTaskComment(teamKey, projectKey, taskNumber);

  const handleSubmit = () => {
    if (!message.trim()) return;

    createUpdate.mutate(message, {
      onSuccess: () => {
        setMessage("");
      },
    });
  };

  const handleCancel = () => {
    setMessage("");
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-background p-5 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Comment</h2>
      </div>

      <div className="flex gap-3">
        <Avatar className="mt-1 h-8 w-8 ring-1 ring-border/60">
          <AvatarFallback>ME</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <AutoResizeTextarea
            value={message}
            onChange={setMessage}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            placeholder="Write a comment..."
            maxLength={2000}
            isLoading={createUpdate.isPending}
          />
        </div>
      </div>
    </section>
  );
}
