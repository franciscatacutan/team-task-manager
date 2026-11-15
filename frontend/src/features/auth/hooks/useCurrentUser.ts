import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { authStorage } from "../utils/authStorage";
import { apiClient } from "../../../api/apiClients";
import type { User } from "../../users/types/userType";

export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.session.current,
    queryFn: async (): Promise<User> => {
      const res = await apiClient.get<User>("/users/me");
      return res.data;
    },
    enabled: authStorage.hasToken(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
