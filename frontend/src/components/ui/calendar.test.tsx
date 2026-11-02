import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Calendar } from "./calendar";

function SelectionExample() {
  const [selected, setSelected] = useState<Date>();
  return (
    <>
      <Calendar
        mode="single"
        defaultMonth={new Date(2026, 10, 1)}
        selected={selected}
        onSelect={setSelected}
        disabled={{ before: new Date(2026, 10, 10) }}
      />
      <output aria-label="Selected date">
        {selected?.toLocaleDateString("en-CA")}
      </output>
    </>
  );
}

describe("calendar after the DayPicker upgrade", () => {
  it("selects an available day and prevents selection of disabled days", async () => {
    const user = userEvent.setup();
    render(<SelectionExample />);
    const disabledDay = screen.getByRole("button", {
      name: /November 9th, 2026/,
    });
    expect(disabledDay).toBeDisabled();
    await user.click(disabledDay);
    expect(screen.getByLabelText("Selected date")).toHaveTextContent("");
    await user.click(
      screen.getByRole("button", { name: /November 10th, 2026/ }),
    );
    expect(screen.getByLabelText("Selected date")).toHaveTextContent(
      "2026-11-10",
    );
    expect(screen.getByRole("gridcell", { selected: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("navigates months and applies the v10 month grid styling", async () => {
    const user = userEvent.setup();
    render(<Calendar defaultMonth={new Date(2026, 10, 1)} />);
    expect(screen.getByRole("grid")).toHaveClass("w-full", "border-collapse");
    await user.click(screen.getByRole("button", { name: /next month/i }));
    expect(
      screen.getByRole("grid", { name: /December 2026/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    expect(
      screen.getByRole("grid", { name: /November 2026/ }),
    ).toBeInTheDocument();
  });
});
