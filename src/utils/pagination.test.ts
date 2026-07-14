import { describe, expect, it } from "vitest";
import { paginationMeta, parsePagination } from "./pagination.js";

describe("pagination utilities", () => {
  it("uses safe defaults", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 12, skip: 0 });
  });

  it("clamps invalid page and large limit values", () => {
    expect(parsePagination({ page: "-4", limit: "999" })).toEqual({
      page: 1,
      limit: 50,
      skip: 0
    });
  });

  it("creates predictable metadata", () => {
    expect(paginationMeta(2, 10, 23)).toEqual({
      page: 2,
      limit: 10,
      total: 23,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true
    });
  });

  it("keeps at least one page for an empty collection", () => {
    expect(paginationMeta(1, 10, 0).totalPages).toBe(1);
  });
});
