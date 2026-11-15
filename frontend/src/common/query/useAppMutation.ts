import { useMutation, type MutationKey } from "@tanstack/react-query";
import { authStorage } from "@/features/auth/utils/authStorage";

interface Options<TData, TVariables> {
  mutationKey: MutationKey;
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
  ) => void | Promise<void>;
}

/** Confirmed writes only. Cache callbacks must belong to the login that submitted the request. */
export function useAppMutation<TData, TVariables>({
  mutationKey,
  mutationFn,
  onSuccess,
  onSettled,
}: Options<TData, TVariables>) {
  const sessionRevision = authStorage.getRevision();
  const isCurrent = (revision: number | undefined) =>
    revision === authStorage.getRevision() && !authStorage.isLoggingOut();
  return useMutation<TData, Error, TVariables, number>({
    mutationKey: [...mutationKey, sessionRevision],
    mutationFn: (variables) => {
      if (!isCurrent(sessionRevision))
        throw new Error(
          "The active account changed before this request could run.",
        );
      return mutationFn(variables);
    },
    retry: false,
    onMutate: () => sessionRevision,
    onSuccess: (data, variables, revision) => {
      if (isCurrent(revision)) return onSuccess?.(data, variables);
    },
    onSettled: (data, error, variables, revision) => {
      if (isCurrent(revision)) return onSettled?.(data, error, variables);
    },
  });
}
