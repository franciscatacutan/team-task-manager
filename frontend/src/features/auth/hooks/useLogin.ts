import { browserSession } from "../utils/sessionCoordinator";
import { queryKeys } from "@/common/query/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/auth.api";
import { authStorage } from "../utils/authStorage";

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.login,
    onSuccess: async (data) => {
      if (browserSession.sync() || authStorage.getToken() !== data.token)
        return;
      const revision = authStorage.getRevision();
      await queryClient.cancelQueries();
      if (revision !== authStorage.getRevision() || authStorage.isLoggingOut())
        return;
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session.current, {
        id: data.user.userId,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        role: data.user.role,
      });
      browserSession.ready();
    },
  });
};
