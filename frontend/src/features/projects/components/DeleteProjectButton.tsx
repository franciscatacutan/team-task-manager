import { Archive } from "lucide-react";
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
import { useDeleteProject } from "../hooks/useDeleteProject";

interface Props {
  teamKey: string;
  projectKey: string;
  projectName: string;
  onProjectDeleted?: () => void;
}

export function DeleteProjectButton({
  teamKey,
  projectKey,
  projectName,
  onProjectDeleted,
}: Props) {
  const navigate = useNavigate();
  const deleteProjectMutation = useDeleteProject(teamKey);

  const handleDelete = () => {
    deleteProjectMutation.mutate(projectKey, {
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
          aria-label="Archive project"
          variant="ghost"
          className=" hover:text-destructive hover:bg-destructive/10"
        >
          <Archive className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive project</AlertDialogTitle>

          <AlertDialogDescription className="space-y-2">
            <span>
              The project and its active tasks will become read-only. Workflow
              status and history will be preserved.
            </span>

            <span className="block">
              You are about to archive
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
            {deleteProjectMutation.isPending ? "Archiving..." : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
