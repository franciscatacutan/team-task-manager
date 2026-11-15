import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserSelector from "./UserSelector";

const users = [
  {
    id: "alice",
    firstName: "Alice",
    lastName: "Member",
    email: "alice@example.test",
    role: "USER" as const,
  },
  {
    id: "bob",
    firstName: "Bob",
    lastName: "Member",
    email: "bob@example.test",
    role: "USER" as const,
  },
];
const originalScroll = HTMLElement.prototype.scrollIntoView;

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
afterEach(() => vi.unstubAllGlobals());

async function openSelector() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: /Select user/ }));
  return user;
}

describe("user selector search compatibility", () => {
  it("keeps local search and user selection working for existing callers", async () => {
    const onChange = vi.fn();
    render(
      <UserSelector
        users={users}
        placeholder="Select user"
        onChange={onChange}
      />,
    );
    const user = await openSelector();
    await user.type(screen.getByPlaceholderText("Search user..."), "Alice");
    expect(
      screen.queryByRole("option", { name: /Bob/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Alice/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("alice");
  });

  it("delegates controlled search to the caller without filtering server-supplied results locally", async () => {
    const onSearchChange = vi.fn();
    render(
      <UserSelector
        users={[users[1]]}
        placeholder="Select user"
        onChange={vi.fn()}
        search="server match"
        onSearchChange={onSearchChange}
      />,
    );
    const user = await openSelector();
    expect(screen.getByRole("option", { name: /Bob/ })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Search user..."), "x");
    expect(onSearchChange).toHaveBeenCalledWith("server matchx");
  });
});
