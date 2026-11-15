import { queryKeys } from "@/common/query/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getUsers } from "../api/userApi";
import type { User } from "../types/userType";
import type { PageResponse } from "@/common/types/pageResponse.types";
import type { UserRole } from "../types/userRole";
import type { DeletedFilter } from "@/common/types/deletedFilter.types";

/*
 * Custom hook to fetch users using React Query
 */
export const useUsers = (params: {
  page: number;
  size: number;
  search?: string;
  roles?: UserRole[];
  visibility?: DeletedFilter;
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
        visibility: params.visibility,
      }),
    placeholderData: keepPreviousData,
  });
};
