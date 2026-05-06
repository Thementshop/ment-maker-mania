import { describe, it, expect } from "vitest";
import { extendMentExpiry, extendChainExpiry } from "@/lib/timerMath";

const HOUR = 60 * 60 * 1000;

describe("extendMentExpiry (single ment, +48h additive)", () => {
  it("adds 48h on top of remaining time (6h left -> 54h left)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const current = new Date(now.getTime() + 6 * HOUR);
    const next = extendMentExpiry(current, now);
    expect(next.getTime() - now.getTime()).toBe(54 * HOUR);
  });

  it("falls back to now+48h when expiry is null", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const next = extendMentExpiry(null, now);
    expect(next.getTime() - now.getTime()).toBe(48 * HOUR);
  });

  it("stacks: applying twice from now+6h yields now+102h", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const start = new Date(now.getTime() + 6 * HOUR);
    const once = extendMentExpiry(start, now);
    const twice = extendMentExpiry(once, now);
    expect(twice.getTime() - now.getTime()).toBe(102 * HOUR);
  });

  it("handles fractional remaining hours", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const current = new Date(now.getTime() + 90 * 60 * 1000); // 1.5h
    const next = extendMentExpiry(current, now);
    expect(next.getTime() - current.getTime()).toBe(48 * HOUR);
  });
});

describe("extendChainExpiry (chain, +24h additive)", () => {
  it("adds 24h on top of remaining time (3h left -> 27h left)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const current = new Date(now.getTime() + 3 * HOUR);
    const next = extendChainExpiry(current, now);
    expect(next.getTime() - now.getTime()).toBe(27 * HOUR);
  });

  it("clamps to now when chain is already expired (past expiry -> now+24h)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const current = new Date(now.getTime() - 1 * HOUR);
    const next = extendChainExpiry(current, now);
    expect(next.getTime() - now.getTime()).toBe(24 * HOUR);
  });

  it("treats expiry exactly at now as the floor", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const next = extendChainExpiry(now, now);
    expect(next.getTime() - now.getTime()).toBe(24 * HOUR);
  });

  it("stacks correctly across multiple uses", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    let exp: Date = new Date(now.getTime() + 3 * HOUR);
    exp = extendChainExpiry(exp, now); // 27h
    exp = extendChainExpiry(exp, now); // 51h
    exp = extendChainExpiry(exp, now); // 75h
    expect(exp.getTime() - now.getTime()).toBe(75 * HOUR);
  });
});
