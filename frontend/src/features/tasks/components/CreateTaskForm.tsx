import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useCreateTask } from "../hooks/useCreateTask";

import UserSelector from "../../../common/components/UserSelector";
import PrioritySelect from "../../../common/components/PrioritySelector";

import {
  createTaskSchema,
  type CreateTaskInput,
} from "../types/createTaskSchema";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import DatePicker from "../../../common/components/DatePicker";
import type { TaskPriority } from "../utils/taskPriority";
import AutoResizeTextareaBase from "../../../common/components/AutoResizeTextareaBase";
import FormField from "../../../common/components/FormFieldWrapper";
import { useTeamMembers } from "../../teams/hooks/useTeamMembers";

interface Props {
  teamKey: string;
  projectKey: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateTaskForm({
  teamKey,
  projectKey,
  onSuccess,
  onCancel,
}: Props) {
  const createTaskMutation = useCreateTask(teamKey, projectKey);
  const { data } = useTeamMembers(teamKey);
  const members = data?.content ?? [];

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

  const MAX_TITLE = 100;
  const MAX_DESC = 2000;

  const title = useWatch({
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

  const onSubmit = (data: CreateTaskInput) => {
    createTaskMutation.mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess?.();
      },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <FormField
          label="Title"
          error={form.formState.errors.name?.message}
          length={title.length}
          maxLength={MAX_TITLE}
        >
          <Input
            {...form.register("name")}
            maxLength={MAX_TITLE}
            placeholder="Enter task title..."
            className="
      border-none px-0 py-0
      focus-visible:ring-0
      shadow-none
      text-sm
    "
          />
        </FormField>
      </div>

      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <FormField
            label="Description"
            error={fieldState.error?.message}
            length={field.value?.length}
            maxLength={MAX_DESC}
          >
            <AutoResizeTextareaBase
              value={field.value || ""}
              onChange={field.onChange}
              placeholder="Add more details about this task..."
              maxLength={2000}
              className="text-sm"
            />
          </FormField>
        )}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Priority</Label>

          <PrioritySelect
            value={priority}
            onChange={(value) =>
              form.setValue("priority", value as TaskPriority, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Assignee</Label>

          <UserSelector
            users={members}
            value={assigneeId}
            excludedUserIds={supportId ? [supportId] : []}
            onChange={(id) =>
              form.setValue("assigneeId", id ?? "", {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            placeholder="Select User"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Support</Label>

          <UserSelector
            users={members}
            allowClear
            value={supportId}
            excludedUserIds={assigneeId ? [assigneeId] : []}
            onChange={(id) => form.setValue("supportId", id ?? undefined)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Planned Start</Label>

          <DatePicker
            value={plannedStartDate ? new Date(plannedStartDate) : undefined}
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
              ) {
                form.setValue("plannedDueDate", iso);
              }

              form.trigger("plannedDueDate");
            }}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Planned Due</Label>

          <DatePicker
            value={plannedDueDate ? new Date(plannedDueDate) : undefined}
            onChange={(date) =>
              form.setValue("plannedDueDate", date ? date.toISOString() : "", {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            disabled={(date) => {
              if (!plannedStartDate) return true;

              return date < new Date(plannedStartDate);
            }}
          />
        </div>
      </div>
      <Separator />

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>

        <Button
          type="submit"
          variant="default"
          disabled={createTaskMutation.isPending || !form.formState.isValid}
        >
          {createTaskMutation.isPending ? "Creating..." : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
