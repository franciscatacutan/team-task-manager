import { isAxiosError } from "axios";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../api/userApi";

/*
 * Custom hook to fetch users using React Query
 */
export const useUser = (userId: string, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),

    queryFn: () => getUser(userId),

    enabled: !!userId && enabled,
    retry: (count, error) =>
      count < 3 &&
      !(
        isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)
      ),
  });
};
