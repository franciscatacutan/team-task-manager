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
import { useDeleteTeam } from "../hooks/UseDeleteTeam";

interface Props {
  teamKey: string;
  teamName: string;
  onTeamDeleted?: () => void;
}

export function DeleteTeam({ teamKey, teamName, onTeamDeleted }: Props) {
  const navigate = useNavigate();
  const deleteTeamMutation = useDeleteTeam();

  const handleDelete = () => {
    deleteTeamMutation.mutate(teamKey, {
      onSuccess: () => {
        if (onTeamDeleted) {
          onTeamDeleted();
        }
        navigate(`/teams`);
      },
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          aria-label="Archive team"
          variant="ghost"
          className=" hover:text-destructive hover:bg-destructive/10"
        >
          <Archive className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive team</AlertDialogTitle>

          <AlertDialogDescription className="space-y-2">
            <span>
              The team and its active projects and tasks will become read-only.
              Workflow status and history will be preserved.
            </span>

            <span className="block">
              You are about to archive
              <span className="font-medium text-foreground">"{teamName}"</span>.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel size="sm" variant="outline">
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteTeamMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            variant="destructive"
            size="sm"
          >
            {deleteTeamMutation.isPending ? "Archiving..." : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
