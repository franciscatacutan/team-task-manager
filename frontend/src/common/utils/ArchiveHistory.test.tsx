import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  activityFormatter,
  getActivityTypeLabel,
  getActivityVerb,
} from "./activityFormatter";

describe("archive history compatibility", () => {
  it.each([
    'Deleted team "Team"',
    'Deleted project "Project"',
    'Deleted task "Task"',
    'Archived team "Team"',
    'Archived project "Project"',
    'Archived task "Task"',
  ])("displays archive language for %s", (message) => {
    render(<div>{activityFormatter(message)}</div>);
    expect(screen.getByText(/Archived/)).toBeInTheDocument();
    expect(getActivityTypeLabel(message)).toBe("Archived");
    expect(getActivityVerb(message)).toBe("archived");
  });
});
