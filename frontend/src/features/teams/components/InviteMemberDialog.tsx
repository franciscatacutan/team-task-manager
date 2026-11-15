import { useId, useRef, useState } from "react";
import CreationDialog from "@/common/components/CreationDialog";
import CreationForm from "@/common/components/CreationForm";
import FormField from "@/common/components/FormFieldWrapper";
import { accountEmailSchema } from "@/common/validation/accountValidation";
import { requestError } from "@/common/utils/requestError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTeamInvitation } from "../api/teamMemberApi";

interface Props {
  teamKey: string;
  onClose: () => void;
}

export default function InviteMemberDialog({ teamKey, onClose }: Props) {
  return (
    <CreationDialog
      open
      name="Invite new member"
      description="Create a single-use link for someone who needs an account."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {(onPendingChange) => (
        <InviteMemberForm
          teamKey={teamKey}
          onClose={onClose}
          onPendingChange={onPendingChange}
        />
      )}
    </CreationDialog>
  );
}

function InviteMemberForm({
  teamKey,
  onClose,
  onPendingChange,
}: Props & {
  onPendingChange: (pending: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<{ link: string; expiresAt: string }>();
  const [copyStatus, setCopyStatus] = useState("");
  const linkId = useId();
  const linkInput = useRef<HTMLInputElement>(null);

  async function submit() {
    const normalized = accountEmailSchema.safeParse(email);
    setError("");
    if (!normalized.success) {
      setEmailError(normalized.error.issues[0].message);
      return;
    }
    setEmailError("");
    try {
      const created = await createTeamInvitation(teamKey, normalized.data);
      const link = new URL("/login", window.location.origin);
      link.hash = new URLSearchParams({ invite: created.token }).toString();
      setInvite({ link: link.toString(), expiresAt: created.expiresAt });
    } catch (failure) {
      setError(
        requestError(
          failure,
          "Unable to create the invitation. Please try again.",
        ),
      );
    }
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopyStatus("Invite link copied.");
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setCopyStatus("Copy the selected link manually.");
    }
  }

  if (invite) {
    return (
      <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6">
        <p className="text-sm">
          Share this link privately with {email.trim()}.
        </p>
        <p className="text-sm text-muted-foreground">
          Expires {new Date(invite.expiresAt).toLocaleString()}.
        </p>
        <label htmlFor={linkId} className="block text-sm font-medium">
          Invite link
        </label>
        <Input id={linkId} ref={linkInput} readOnly value={invite.link} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void copy()}>Copy link</Button>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {copyStatus}
        </p>
      </div>
    );
  }

  return (
    <CreationForm
      entity="invite"
      canSubmit={Boolean(email.trim())}
      error={error}
      onSubmit={submit}
      onCancel={onClose}
      onPendingChange={onPendingChange}
    >
      <FormField label="Email" required framed={false} error={emailError}>
        {(control) => (
          <Input
            {...control}
            type="email"
            maxLength={150}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError("");
              setError("");
            }}
          />
        )}
      </FormField>
    </CreationForm>
  );
}
