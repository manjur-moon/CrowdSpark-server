import { describe, expect, it } from "vitest";
import { buildPublicCampaignFilter } from "./public.service.js";

describe("public campaign filter builder", () => {
  const now = new Date("2026-07-14T00:00:00.000Z");

  it("keeps approved campaigns active by default", () => {
    expect(buildPublicCampaignFilter({}, now)).toEqual({
      status: "approved",
      deadline: { $gt: now }
    });
  });

  it("supports category, goal and deadline filters", () => {
    const filter = buildPublicCampaignFilter(
      { category: "Technology", minGoal: 100, maxGoal: 1000, deadline: "30d" },
      now
    );
    expect(filter.category).toBe("Technology");
    expect(filter.goalCredits).toEqual({ $gte: 100, $lte: 1000 });
    expect(filter.deadline).toEqual({
      $gt: now,
      $lte: new Date("2026-08-13T00:00:00.000Z")
    });
  });

  it("escapes regular-expression characters in search text", () => {
    const filter = buildPublicCampaignFilter({ search: "solar.*pump" }, now);
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.objectContaining({ $regex: "solar\\.\\*pump" })
        })
      ])
    );
  });
});
