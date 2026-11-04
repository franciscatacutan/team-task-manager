import { useState } from "react";
import { requestError } from "@/common/utils/requestError";
import { Archive } from "lucide-react";
import { useDeleteTask } from "../hooks/useDeleteTask";
import { useNavigate } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Button } from "../../../components/ui/button";

interface Props {
  teamKey: string;
  projectKey: string;
  taskNumber: number;
  taskName: string;
  onTaskDeleted?: () => void;
}

export default function DeleteTaskButton({
  teamKey,
  projectKey,
  taskNumber,
  taskName,
  onTaskDeleted,
}: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const deleteTaskMutation = useDeleteTask(teamKey, projectKey);

  const handleDelete = () => {
    deleteTaskMutation.mutate(taskNumber, {
      onSuccess: () => {
        setOpen(false);
        if (onTaskDeleted) {
          onTaskDeleted();
        }
        navigate(`/teams/${teamKey}/projects/${projectKey}`);
      },
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!deleteTaskMutation.isPending) {
          if (value) deleteTaskMutation.reset();
          setOpen(value);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          aria-label="Archive task"
          variant="ghost"
          className=" hover:text-destructive hover:bg-destructive/10"
        >
          <Archive className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive task</AlertDialogTitle>

          <AlertDialogDescription className="space-y-2">
            <span>
              The task will become read-only. Its workflow status and history
              will be preserved.
            </span>

            <span className="block">
              You are about to archive{" "}
              <span className="font-medium text-foreground">"{taskName}"</span>.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteTaskMutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {requestError(deleteTaskMutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={deleteTaskMutation.isPending}
            size="sm"
            variant="outline"
          >
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
            disabled={deleteTaskMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            variant="destructive"
            size="sm"
          >
            {deleteTaskMutation.isPending ? "Archiving..." : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
