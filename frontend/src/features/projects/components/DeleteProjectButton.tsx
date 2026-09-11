import { Trash2 } from "lucide-react";
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
import { useDeleteProject } from "../hooks/useDeleteProject";

interface Props {
  teamKey: string;
  projectId: string;
  projectName: string;
  onProjectDeleted?: () => void;
}

export function DeleteProjectButton({
  teamKey,
  projectId,
  projectName,
  onProjectDeleted,
}: Props) {
  const navigate = useNavigate();
  const deleteProjectMutation = useDeleteProject(teamKey);

  const handleDelete = () => {
    deleteProjectMutation.mutate(projectId, {
      onSuccess: () => {
        if (onProjectDeleted) {
          onProjectDeleted();
        }
        navigate(`/teams/${teamKey}/projects`);
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
          <AlertDialogTitle>Delete Project</AlertDialogTitle>

          <AlertDialogDescription className="space-y-2">
            <span>This action cannot be undone.</span>

            <span className="block">
              You are about to delete
              <span className="font-medium text-foreground">
                "{projectName}"
              </span>
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
            disabled={deleteProjectMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            variant="destructive"
            size="sm"
          >
            {deleteProjectMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
