import { describe, it, expect } from "vitest";
import { getDownloadUrl } from "../lib/api";

describe("API Helpers", () => {
  describe("getDownloadUrl", () => {
    it("should construct correct download URL", () => {
      const url = getDownloadUrl("test_case");
      expect(url).toBe("http://localhost:8000/api/download/test_case");
    });

    it("should handle URL encoding", () => {
      const url = getDownloadUrl("test case with spaces");
      expect(url).toContain("test%20case%20with%20spaces");
    });

    it("should handle special characters", () => {
      const url = getDownloadUrl("case/name@special");
      expect(url).toContain("case%2Fname%40special");
    });
  });
});

describe("Type Definitions", () => {
  it("should export correct interfaces", async () => {
    const api = await import("../lib/api");
    expect(api).toBeDefined();
    expect(typeof api.getDownloadUrl).toBe("function");
    expect(typeof api.runInference).toBe("function");
    expect(typeof api.checkHealth).toBe("function");
  });
});
