import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import DatePicker from "@/common/components/DatePicker";
import { Input } from "@/components/ui/input";
import AutoResizeTextareaBase from "@/common/components/AutoResizeTextareaBase";
import FormField from "@/common/components/FormFieldWrapper";
import CreationForm from "@/common/components/CreationForm";
import { requestError } from "@/common/utils/requestError";
import { useCreateProject } from "../hooks/useCreateProject";
import {
  createProjectSchema,
  type CreateProjectInput,
} from "../types/createProjectSchema";

interface Props {
  teamKey: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
}

export function CreateProjectForm({
  teamKey,
  onSuccess,
  onCancel,
  onPendingChange,
}: Props) {
  const mutation = useCreateProject(teamKey);
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    mode: "onChange",
    defaultValues: { name: "", description: "", plannedDueDate: null },
  });
  const name = useWatch({ control: form.control, name: "name" });
  async function onSubmit({ plannedDueDate, ...details }: CreateProjectInput) {
    try {
      await mutation.mutateAsync(
        { ...details, ...(plannedDueDate ? { plannedDueDate } : {}) },
        {
          onSuccess: () => {
            form.reset();
            onSuccess?.();
          },
        },
      );
    } catch {
      // Mutation state displays the failure; keep all fields for a deliberate retry.
    }
  }
  return (
    <CreationForm
      entity="Project"
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
            placeholder="Enter project name..."
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
                placeholder="Add more details about this project..."
                maxLength={2000}
              />
            )}
          </FormField>
        )}
      />
      <Controller
        control={form.control}
        name="plannedDueDate"
        render={({ field, fieldState }) => (
          <FormField
            label="Due date"
            hint="Optional."
            framed={false}
            error={fieldState.error?.message}
          >
            {(control) => (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-40 flex-1">
                  <DatePicker
                    {...control}
                    value={field.value ? parseISO(field.value) : undefined}
                    onChange={(date) =>
                      field.onChange(date ? format(date, "yyyy-MM-dd") : null)
                    }
                    placeholder="No due date"
                    triggerDisabled={mutation.isPending}
                  />
                </div>
                {field.value && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => field.onChange(null)}
                  >
                    Clear due date
                  </Button>
                )}
              </div>
            )}
          </FormField>
        )}
      />
    </CreationForm>
  );
}
