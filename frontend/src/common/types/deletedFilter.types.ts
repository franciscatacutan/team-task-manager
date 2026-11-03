import type { FilterGroup } from "./filter.types";

export type DeletedFilter = "ACTIVE" | "ALL" | "DELETED";

export const DELETED_FILTER: FilterGroup[] = [
  {
    key: "deletedFilter",
    label: "Visibility",
    type: "single",
    options: [
      { label: "Active", value: "ACTIVE", isDefault: true },
      { label: "Archived", value: "DELETED" },
      { label: "All", value: "ALL" },
    ],
  },
];
