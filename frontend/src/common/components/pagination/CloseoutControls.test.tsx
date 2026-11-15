import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageSizeSelector } from "./PageSizeSelector";
import ProjectStatusSelector from "@/features/projects/components/ProjectStatusSelector";
import {
  getActivityEventLabel,
  getActivityTypeLabel,
} from "@/common/utils/activityFormatter";

describe("close-out control names", () => {
  it("names the page-size control independently of the selected number", () => {
    render(<PageSizeSelector size={20} onChange={vi.fn()} />);
    expect(
      screen.getByRole("combobox", { name: "Rows per page" }),
    ).toHaveTextContent("20");
  });
  it("names project status in editable and disabled states", () => {
    const view = render(
      <ProjectStatusSelector value="ACTIVE" onChange={vi.fn()} />,
    );
    expect(
      screen.getByRole("combobox", { name: "Project status" }),
    ).toHaveTextContent("Active");
    view.rerender(
      <ProjectStatusSelector value="ACTIVE" onChange={vi.fn()} disabled />,
    );
    expect(
      screen.getByRole("combobox", { name: "Project status" }),
    ).toBeDisabled();
  });
  it("retains legacy activity labels while distinguishing unknown structured events", () => {
    expect(getActivityTypeLabel("Created team Alpha")).toBe("Created");
    expect(getActivityTypeLabel("A teammate comment")).toBe("Comment");
    expect(getActivityEventLabel("PROJECT_DELETED")).toBe("Archived");
    expect(getActivityEventLabel("TEAM_DELETED")).toBe("Archived");
    expect(getActivityEventLabel("TASK_DELETED")).toBe("Archived");
    for (const unknown of [
      "DELIVERY_RETRY_SCHEDULED",
      "constructor",
      "__proto__",
    ])
      expect(getActivityEventLabel(unknown)).toBeUndefined();
  });
});
