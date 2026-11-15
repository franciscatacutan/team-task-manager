import { describe, expect, it, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("browser API deployment configuration", () => {
  it.each([undefined, "", "   "])(
    "uses /api for a blank origin (%s)",
    async (origin) => {
      vi.stubEnv("VITE_API_URL", origin);
      vi.resetModules();
      const config = await import("./apiConfig");
      expect(config.apiBaseURL).toBe("/api");
      expect(config.configuredApiOrigin).toBe("");
    },
  );
  it("keeps an explicit origin without doubling trailing slashes", async () => {
    vi.stubEnv("VITE_API_URL", " https://api.example.test/// ");
    vi.resetModules();
    const config = await import("./apiConfig");
    expect(config.apiBaseURL).toBe("https://api.example.test/api");
  });
});
