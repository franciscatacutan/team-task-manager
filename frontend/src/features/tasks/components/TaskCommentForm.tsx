import { useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AutoResizeTextarea from "@/common/components/AutoResizeTextareaForm";
import { requestError } from "@/common/utils/requestError";
import { authStorage } from "@/features/auth/utils/authStorage";
import { useCreateTaskComment } from "../hooks/useCreateTaskComment";

interface Props {
  teamKey: string;
  projectKey: string;
  taskNumber: number;
}

export default function TaskCommentForm(props: Props) {
  return (
    <CommentComposer
      key={JSON.stringify([
        props.teamKey,
        props.projectKey,
        props.taskNumber,
        authStorage.getRevision(),
      ])}
      {...props}
    />
  );
}

function CommentComposer({ teamKey, projectKey, taskNumber }: Props) {
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  const createUpdate = useCreateTaskComment(teamKey, projectKey, taskNumber);

  const handleSubmit = () => {
    if (!message.trim() || submitting.current || createUpdate.isPending) return;
    submitting.current = true;
    const revision = authStorage.getRevision();
    createUpdate.mutate(message, {
      onSuccess: () => {
        if (
          revision === authStorage.getRevision() &&
          !authStorage.isLoggingOut()
        )
          setMessage("");
      },
      onSettled: () => {
        submitting.current = false;
      },
    });
  };

  const handleCancel = () => {
    if (submitting.current) return;
    createUpdate.reset();
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

        <div className="min-w-0 flex-1">
          <AutoResizeTextarea
            value={message}
            onChange={(value) => {
              if (submitting.current) return;
              createUpdate.reset();
              setMessage(value);
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            placeholder="Write a comment..."
            maxLength={2000}
            isLoading={createUpdate.isPending}
            error={
              createUpdate.isError
                ? requestError(
                    createUpdate.error,
                    "Unable to post your comment. Please retry.",
                  )
                : undefined
            }
          />
          {createUpdate.isSuccess && (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              Comment posted.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
