import { queryKeys } from "@/common/query/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getUsers } from "../api/userApi";
import type { User } from "../types/userType";
import type { PageResponse } from "@/common/types/pageResponse.types";
import type { UserRole } from "../types/userRole";

/*
 * Custom hook to fetch users using React Query
 */
export const useUsers = (params: {
  page: number;
  size: number;
  search?: string;
  roles?: UserRole[];
  sort?: string;
}) => {
  return useQuery<PageResponse<User>>({
    queryKey: queryKeys.users.list(params),
    queryFn: () =>
      getUsers({
        page: params.page,
        size: params.size,
        search: params.search,
        sort: params.sort,
        roles: params.roles,
      }),
    placeholderData: keepPreviousData,
  });
};
