export type FilterOption = {
  label: string;
  value: string;
  isDefault?: boolean;
};

export type FilterGroup = {
  key: string;
  label: string;
  type?: "single" | "multi";
  options: FilterOption[];
};
