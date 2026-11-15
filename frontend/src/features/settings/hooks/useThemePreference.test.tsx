import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useThemePreference } from "./useThemePreference";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

it("follows the OS live and keeps an explicit choice across both consumers", () => {
  const media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", () => media);
  function Settings() {
    const { setTheme } = useThemePreference();
    return (
      <>
        <button onClick={() => setTheme("light")}>Light</button>
        <button onClick={() => setTheme("system")}>System</button>
      </>
    );
  }
  function App() {
    useThemePreference();
    return <Settings />;
  }
  function systemChange(matches: boolean) {
    act(() => {
      media.matches = matches;
      media.dispatchEvent(new Event("change"));
    });
  }

  render(<App />);
  expect(document.documentElement).not.toHaveClass("dark");
  systemChange(true);
  expect(document.documentElement).toHaveClass("dark");
  fireEvent.click(screen.getByRole("button", { name: "Light" }));
  systemChange(false);
  systemChange(true);
  expect(document.documentElement).not.toHaveClass("dark");
  fireEvent.click(screen.getByRole("button", { name: "System" }));
  expect(document.documentElement).toHaveClass("dark");
});
