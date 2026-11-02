import { useMutation } from "@tanstack/react-query";

import { updatePassword, type UpdatePasswordPayload } from "../api/settingsApi";

export const useUpdatePassword = (userId: string) => {
  return useMutation({
    mutationFn: (payload: UpdatePasswordPayload) =>
      updatePassword(userId, payload),
  });
};
