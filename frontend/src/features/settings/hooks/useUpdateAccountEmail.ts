import { useAppMutation } from "@/common/query/useAppMutation";
import { mutationKeys } from "@/common/query/queryKeys";

import {
  updateAccountEmail,
  type UpdateAccountEmailPayload,
} from "../api/settingsApi";

export const useUpdateAccountEmail = () => {
  return useAppMutation({
    mutationKey: mutationKeys.accountEmail,
    mutationFn: (payload: UpdateAccountEmailPayload) =>
      updateAccountEmail(payload),
  });
};
