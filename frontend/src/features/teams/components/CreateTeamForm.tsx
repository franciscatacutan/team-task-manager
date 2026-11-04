import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import AutoResizeTextareaBase from "@/common/components/AutoResizeTextareaBase";
import FormField from "@/common/components/FormFieldWrapper";
import CreationForm from "@/common/components/CreationForm";
import { requestError } from "@/common/utils/requestError";
import { useCreateTeam } from "../hooks/useCreateTeam";
import {
  createTeamSchema,
  type CreateTeamInput,
} from "../types/createTeamSchema.types";
import type { Team } from "../types/team.type";
interface Props {
  onSuccess?: (team: Team) => void;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
}

export function CreateTeamForm({
  onSuccess,
  onCancel,
  onPendingChange,
}: Props) {
  const mutation = useCreateTeam();
  const form = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
    mode: "onChange",
    defaultValues: { name: "", description: "" },
  });
  const name = useWatch({ control: form.control, name: "name" });
  async function onSubmit(data: CreateTeamInput) {
    try {
      await mutation.mutateAsync(data, {
        onSuccess: (team) => {
          form.reset();
          onSuccess?.(team);
        },
      });
    } catch {
      // Mutation state displays the failure; keep all fields for a deliberate retry.
    }
  }
  return (
    <CreationForm
      entity="Team"
      canSubmit={form.formState.isValid}
      error={mutation.isError ? requestError(mutation.error) : undefined}
      onSubmit={form.handleSubmit(onSubmit)}
      onCancel={onCancel}
      onPendingChange={onPendingChange}
    >
      <FormField
        label="Name"
        required
        hint="At least 3 characters."
        error={form.formState.errors.name?.message}
        length={name.length}
        maxLength={100}
      >
        {(control) => (
          <Input
            {...form.register("name")}
            {...control}
            aria-required="true"
            maxLength={100}
            placeholder="Enter team name..."
            className="border-none px-0 py-0 text-sm shadow-none focus-visible:ring-0"
          />
        )}
      </FormField>
      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <FormField
            label="Description"
            hint="Optional."
            error={fieldState.error?.message}
            length={field.value?.length}
            maxLength={2000}
          >
            {(control) => (
              <AutoResizeTextareaBase
                {...control}
                name={field.name}
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Add more details about this team..."
                maxLength={2000}
              />
            )}
          </FormField>
        )}
      />
    </CreationForm>
  );
}
