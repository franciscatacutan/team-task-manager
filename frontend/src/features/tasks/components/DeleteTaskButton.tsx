import { Trash2 } from "lucide-react";
import { useDeleteTask } from "../hooks/useDeleteTask";
import { useNavigate } from "react-router-dom";
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
  taskTitle: string;
  onTaskDeleted?: () => void;
}

export default function DeleteTaskButton({
  teamKey,
  projectKey,
  taskNumber,
  taskTitle,
  onTaskDeleted,
}: Props) {
  const navigate = useNavigate();
  const deleteTaskMutation = useDeleteTask(teamKey, projectKey);

  const handleDelete = () => {
    deleteTaskMutation.mutate(taskNumber, {
      onSuccess: () => {
        if (onTaskDeleted) {
          onTaskDeleted();
        }
        navigate(`/teams/${teamKey}/projects/${projectKey}`);
      },
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          className=" hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task</AlertDialogTitle>

          <AlertDialogDescription className="space-y-2">
            <span>This action cannot be undone.</span>

            <span className="block">
              You are about to delete{" "}
              <span className="font-medium text-foreground">"{taskTitle}"</span>
              .
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel size="sm" variant="outline">
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteTaskMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            variant="destructive"
            size="sm"
          >
            {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
