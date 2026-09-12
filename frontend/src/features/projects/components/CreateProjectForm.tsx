import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Input } from "../../../components/ui/input";
import {
  type CreateProjectInput,
  createProjectSchema,
} from "../types/createProjectSchema";
import { Button } from "../../../components/ui/button";
import { useCreateProject } from "../hooks/useCreateProject";
import { Separator } from "../../../components/ui/separator";
import AutoResizeTextareaBase from "../../../common/components/AutoResizeTextareaBase";
import FormField from "../../../common/components/FormFieldWrapper";

interface Props {
  teamKey: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateProjectForm({ teamKey, onSuccess, onCancel }: Props) {
  const createProjectMutation = useCreateProject(teamKey);

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const MAX_NAME = 100;
  const MAX_DESC = 2000;

  const name = useWatch({
    control: form.control,
    name: "name",
    defaultValue: "",
  });

  const onSubmit = (data: CreateProjectInput) => {
    createProjectMutation.mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess?.();
      },
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <FormField
          label="Name"
          error={form.formState.errors.name?.message}
          length={name.length}
          maxLength={MAX_NAME}
        >
          <Input
            {...form.register("name")}
            maxLength={MAX_NAME}
            placeholder="Enter project name..."
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
              placeholder="Add more details about this project..."
              maxLength={2000}
              className="text-sm"
            />
          </FormField>
        )}
      />
      <Separator />

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>

        <Button
          type="submit"
          variant="default"
          disabled={createProjectMutation.isPending || !form.formState.isValid}
        >
          {createProjectMutation.isPending ? "Creating..." : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
