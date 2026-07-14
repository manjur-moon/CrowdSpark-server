import { describe, expect, it } from "vitest";
import { publicCampaignListQuerySchema } from "./public.validation.js";

describe("public campaign query validation", () => {
  it("coerces numeric query parameters", () => {
    const value = publicCampaignListQuerySchema.parse({ page: "2", minGoal: "100" });
    expect(value.page).toBe(2);
    expect(value.minGoal).toBe(100);
  });

  it("rejects an inverted goal range", () => {
    expect(() => publicCampaignListQuerySchema.parse({ minGoal: "500", maxGoal: "100" })).toThrow();
  });

  it("rejects unsupported sort values", () => {
    expect(() => publicCampaignListQuerySchema.parse({ sort: "random" })).toThrow();
  });
});
