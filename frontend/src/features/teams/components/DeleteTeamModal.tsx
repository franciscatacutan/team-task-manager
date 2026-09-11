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
          variant="ghost"
          className=" hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Team</AlertDialogTitle>

          <AlertDialogDescription className="space-y-2">
            <span>This action cannot be undone.</span>

            <span className="block">
              You are about to delete
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
            {deleteTeamMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
