import { useEffect, useRef, useState } from "react";
import { requestError } from "@/common/utils/requestError";
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
  const [open, setOpen] = useState(false);
  const activeProject = useRef<{ teamKey: string; projectKey: string }>(null);
  useEffect(() => {
    activeProject.current = { teamKey, projectKey };
    return () => {
      activeProject.current = null;
    };
  }, [teamKey, projectKey]);

  const deleteProjectMutation = useDeleteProject(
    teamKey,
    (archivedProjectKey) => {
      if (
        activeProject.current?.teamKey !== teamKey ||
        activeProject.current.projectKey !== archivedProjectKey
      )
        return;

      setOpen(false);
      if (onProjectDeleted) onProjectDeleted();
      else navigate(`/teams/${teamKey}/projects`);
    },
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!deleteProjectMutation.isPending) {
          if (value) deleteProjectMutation.reset();
          setOpen(value);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          aria-label="Archive project"
          variant="ghost"
          className="h-11 w-11 rounded-xl hover:text-destructive hover:bg-destructive/10 sm:h-9 sm:w-9"
        >
          <Archive className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive project</AlertDialogTitle>

          <AlertDialogDescription className="space-y-2">
            <span className="block">
              <span className="font-medium text-foreground">
                “{projectName}”
              </span>{" "}
              and its tasks will become read-only. Team owners, team admins, and
              global admins can still view their history.
            </span>
            <span className="block">
              Recovery requires a database operator and a backup from before
              archiving.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteProjectMutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {requestError(deleteProjectMutation.error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={deleteProjectMutation.isPending}
            size="sm"
            variant="outline"
          >
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              deleteProjectMutation.mutate(projectKey);
            }}
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
