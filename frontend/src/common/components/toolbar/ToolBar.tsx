import { type DeletedFilter } from "../../types/deletedFilter.types";
import { FilterPopover } from "./FilterPopover";
import SearchBar from "@/common/components/toolbar/SearchBar";
import { SortControl } from "@/common/components/toolbar/SortControl";
import type { SortField, SortOrder } from "@/common/types/sort.types";
import type { FilterGroup } from "../../types/filter.types";

type FilterValues = Record<string, string | string[] | undefined>;

interface Props {
  search: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  };

  filters?: {
    config: FilterGroup[];
    values: FilterValues;
    onChange: (key: string, value: string | string[]) => void;
    onDeletedChange?: (value: DeletedFilter) => void;
    onClear?: () => void;
  };

  view: "board" | "list";

  sort: {
    field: SortField;
    order: SortOrder;
    options: { label: string; value: SortField }[];
    onFieldChange: (field: SortField) => void;
    onToggleOrder: () => void;
  };
}

export default function Toolbar({ search, filters, view, sort }: Props) {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/92 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <SearchBar
            label={search.label}
            search={search.value}
            searchChange={search.onChange}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filters && (
            <FilterPopover
              label="Filters"
              config={filters.config}
              values={filters.values}
              onChange={filters.onChange}
              onClear={() => {
                if (filters.onClear) {
                  filters.onClear();
                  return;
                }

                filters.config.forEach((group) => {
                  filters.onChange(group.key, group.type === "multi" ? [] : "");
                });
                filters.onDeletedChange?.("ACTIVE");
              }}
            />
          )}

          {view === "board" && (
            <SortControl
              field={sort.field}
              order={sort.order}
              options={sort.options}
              onFieldChange={sort.onFieldChange}
              onToggleOrder={sort.onToggleOrder}
            />
          )}
        </div>
      </div>
    </section>
  );
}
