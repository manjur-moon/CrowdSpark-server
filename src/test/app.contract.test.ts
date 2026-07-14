import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";

describe("application HTTP contract", () => {
  it("returns health data and security headers", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns the centralized not-found response", async () => {
    const response = await request(app).get("/api/v1/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("rejects invalid filter ranges before querying MongoDB", async () => {
    const response = await request(app).get("/api/v1/campaigns?minGoal=500&maxGoal=100");
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
