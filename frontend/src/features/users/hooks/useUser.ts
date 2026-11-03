import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../api/userApi";

/*
 * Custom hook to fetch users using React Query
 */
export const useUser = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.users.detail(userId),

    queryFn: () => getUser(userId),

    enabled: !!userId,
  });
};
