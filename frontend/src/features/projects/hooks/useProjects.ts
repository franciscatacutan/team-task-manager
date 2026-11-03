import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../api/projectApi";
import type { Project } from "../types/project.types";
import type { PageResponse } from "../../../common/types/pageResponse.types";

import type { ProjectSearchParams } from "../types/project.requests";

export const useProjects = (
  teamKey: string,
  params: ProjectSearchParams = {},
) => {
  return useQuery<PageResponse<Project>>({
    queryKey: queryKeys.projects.list(teamKey, params),
    queryFn: () => getProjects(teamKey, params),
    enabled: Boolean(teamKey),
    placeholderData: (data, previous) =>
      keepPreviousDataInScope(
        data,
        previous,
        queryKeys.projects.lists(teamKey),
      ),
  });
};
