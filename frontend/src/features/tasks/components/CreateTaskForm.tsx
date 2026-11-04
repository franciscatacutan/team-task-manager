import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import CreationForm from "@/common/components/CreationForm";
import FormField from "@/common/components/FormFieldWrapper";
import AutoResizeTextareaBase from "@/common/components/AutoResizeTextareaBase";
import DatePicker from "@/common/components/DatePicker";
import PrioritySelect from "@/common/components/PrioritySelector";
import TeamMemberSelector from "@/features/teams/components/TeamMemberSelector";
import { useCreateTask } from "../hooks/useCreateTask";
import { taskMutationError } from "../utils/taskMutationError";
import {
  createTaskSchema,
  type CreateTaskInput,
} from "../types/createTaskSchema";

interface Props {
  teamKey: string;
  projectKey: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
}

export function CreateTaskForm({
  teamKey,
  projectKey,
  onSuccess,
  onCancel,
  onPendingChange,
}: Props) {
  const createTaskMutation = useCreateTask(teamKey, projectKey);

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      assigneeId: "",
      supportId: undefined,
      plannedStartDate: "",
      plannedDueDate: "",
    },
  });

  const MAX_NAME = 100;
  const MAX_DESC = 2000;

  const name = useWatch({
    control: form.control,
    name: "name",
  });

  const priority = useWatch({
    control: form.control,
    name: "priority",
  });

  const assigneeId = useWatch({
    control: form.control,
    name: "assigneeId",
  });

  const supportId = useWatch({
    control: form.control,
    name: "supportId",
  });

  const plannedStartDate = useWatch({
    control: form.control,
    name: "plannedStartDate",
  });

  const plannedDueDate = useWatch({
    control: form.control,
    name: "plannedDueDate",
  });

  async function onSubmit(data: CreateTaskInput) {
    try {
      await createTaskMutation.mutateAsync(data, {
        onSuccess: () => {
          form.reset();
          onSuccess?.();
        },
      });
    } catch {
      // Mutation state displays the failure; keep the complete task draft for retry.
    }
  }
  return (
    <CreationForm
      entity="Task"
      canSubmit={form.formState.isValid}
      error={
        createTaskMutation.isError
          ? taskMutationError(createTaskMutation.error)
          : undefined
      }
      onSubmit={form.handleSubmit(onSubmit)}
      onCancel={onCancel}
      onPendingChange={onPendingChange}
    >
      {(pending) => (
        <>
          <FormField
            label="Name"
            required
            hint="1–100 characters after trimming."
            error={form.formState.errors.name?.message}
            length={name.length}
            maxLength={MAX_NAME}
          >
            {(control) => (
              <Input
                {...form.register("name")}
                {...control}
                aria-required="true"
                maxLength={MAX_NAME}
                placeholder="Enter task name..."
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
                maxLength={MAX_DESC}
              >
                {(control) => (
                  <AutoResizeTextareaBase
                    {...control}
                    name={field.name}
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Add more details about this task..."
                    maxLength={MAX_DESC}
                  />
                )}
              </FormField>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label="Priority"
              required
              framed={false}
              error={form.formState.errors.priority?.message}
            >
              {(control) => (
                <PrioritySelect
                  {...control}
                  aria-required="true"
                  value={priority}
                  disabled={pending}
                  onChange={(value) =>
                    form.setValue("priority", value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </FormField>
            <FormField
              label="Assignee"
              required
              framed={false}
              error={form.formState.errors.assigneeId?.message}
            >
              {(control) => (
                <TeamMemberSelector
                  {...control}
                  aria-label="Assignee"
                  aria-required="true"
                  teamKey={teamKey}
                  value={assigneeId}
                  disabled={pending}
                  excludedUserIds={supportId ? [supportId] : []}
                  onChange={(id) =>
                    form.setValue("assigneeId", id ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select assignee"
                />
              )}
            </FormField>
            <FormField
              label="Support"
              hint="Optional."
              framed={false}
              error={form.formState.errors.supportId?.message}
            >
              {(control) => (
                <TeamMemberSelector
                  {...control}
                  aria-label="Support"
                  teamKey={teamKey}
                  allowClear
                  value={supportId}
                  disabled={pending}
                  excludedUserIds={assigneeId ? [assigneeId] : []}
                  onChange={(id) =>
                    form.setValue("supportId", id ?? undefined, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select support"
                />
              )}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Planned Start"
              required
              framed={false}
              error={form.formState.errors.plannedStartDate?.message}
            >
              {(control) => (
                <DatePicker
                  {...control}
                  aria-label="Planned Start"
                  triggerDisabled={pending}
                  value={
                    plannedStartDate ? new Date(plannedStartDate) : undefined
                  }
                  onChange={(date) => {
                    const iso = date ? date.toISOString() : "";
                    form.setValue("plannedStartDate", iso, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    if (
                      plannedDueDate &&
                      date &&
                      new Date(iso) > new Date(plannedDueDate)
                    )
                      form.setValue("plannedDueDate", iso);
                    void form.trigger("plannedDueDate");
                  }}
                />
              )}
            </FormField>
            <FormField
              label="Planned Due"
              required
              framed={false}
              error={form.formState.errors.plannedDueDate?.message}
            >
              {(control) => (
                <DatePicker
                  {...control}
                  aria-label="Planned Due"
                  triggerDisabled={pending}
                  value={plannedDueDate ? new Date(plannedDueDate) : undefined}
                  onChange={(date) =>
                    form.setValue(
                      "plannedDueDate",
                      date ? date.toISOString() : "",
                      { shouldValidate: true, shouldDirty: true },
                    )
                  }
                  disabled={(date) =>
                    !plannedStartDate || date < new Date(plannedStartDate)
                  }
                />
              )}
            </FormField>
          </div>
        </>
      )}
    </CreationForm>
  );
}
