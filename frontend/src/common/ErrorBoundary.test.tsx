import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";
import CrashRecovery from "./components/CrashRecovery";
import ErrorPage from "@/pages/ErrorPage";
import { authStorage } from "@/features/auth/utils/authStorage";

const detail = "Private diagnostic detail from a failed application";
function RenderFailure(): never {
  throw new Error(detail);
}
function EffectFailure() {
  useEffect(() => {
    throw new Error(detail);
  }, []);
  return <p>Temporary application content</p>;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  authStorage.clearToken();
  window.localStorage.clear();
});

describe("root crash recovery", () => {
  it("passes through healthy application content", () => {
    render(
      <ErrorBoundary>
        <p>Healthy application</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Healthy application")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Reload" }),
    ).not.toBeInTheDocument();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([RenderFailure, EffectFailure])(
    "renders and focuses recovery after a React failure without any providers (%s)",
    (Failure) => {
      render(
        <ErrorBoundary>
          <Failure />
        </ErrorBoundary>,
      );
      const heading = screen.getByRole("heading", {
        name: "Something went wrong",
      });
      expect(heading).toHaveFocus();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Reload to try again or open your workspace.",
      );
      expect(screen.queryByText(detail)).not.toBeInTheDocument();
      expect(console.error).toHaveBeenCalledWith(
        "UI Crash:",
        expect.any(Error),
      );
    },
  );

  it("survives the loss of router and query context when their subtree crashes", () => {
    const client = new QueryClient();
    render(
      <ErrorBoundary>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <RenderFailure />
          </MemoryRouter>
        </QueryClientProvider>
      </ErrorBoundary>,
    );
    expect(screen.getByRole("main")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload" })).toBeEnabled();
    expect(
      screen.getByRole("link", { name: "Open workspace" }),
    ).toHaveAttribute("href", "/teams");
    client.clear();
  });

  it("also recovers when a provider fails before supplying its children", () => {
    function BrokenProvider(): never {
      throw new Error("Provider initialization failed");
    }
    render(
      <ErrorBoundary>
        <BrokenProvider />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("link", { name: "Open workspace" })).toBeVisible();
    expect(
      screen.queryByText("Provider initialization failed"),
    ).not.toBeInTheDocument();
  });

  it("keeps recovery latched until explicit full-page navigation", () => {
    const view = render(
      <ErrorBoundary>
        <RenderFailure />
      </ErrorBoundary>,
    );
    view.rerender(
      <ErrorBoundary>
        <p>Changed subtree</p>
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
    expect(screen.queryByText("Changed subtree")).not.toBeInTheDocument();
  });

  it("exposes native keyboard actions without clearing session or preference storage", async () => {
    authStorage.setToken("existing-session");
    window.localStorage.setItem("existing-preference", "dark");
    render(<CrashRecovery />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Reload" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Reload" })).toHaveAttribute(
      "type",
      "button",
    );
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Open workspace" })).toHaveFocus();
    expect(authStorage.getToken()).toBe("existing-session");
    expect(window.localStorage.getItem("existing-preference")).toBe("dark");
  });

  it("preserves the existing router-owned unknown-route screen", () => {
    render(
      <MemoryRouter initialEntries={["/unknown"]}>
        <Routes>
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Go back" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Open workspace" }),
    ).not.toBeInTheDocument();
  });
});
