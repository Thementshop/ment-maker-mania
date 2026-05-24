import { describe, it, expect } from "vitest";
import { extendChainExpiry } from "@/lib/timerMath";

const HOUR = 60 * 60 * 1000;

describe("extendChainExpiry (chain, +48h additive)", () => {
  it("adds 48h on top of remaining time (3h left -> 51h left)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const current = new Date(now.getTime() + 3 * HOUR);
    const next = extendChainExpiry(current, now);
    expect(next.getTime() - now.getTime()).toBe(51 * HOUR);
  });

  it("clamps to now when chain is already expired (past expiry -> now+48h)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const current = new Date(now.getTime() - 1 * HOUR);
    const next = extendChainExpiry(current, now);
    expect(next.getTime() - now.getTime()).toBe(48 * HOUR);
  });

  it("treats expiry exactly at now as the floor", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const next = extendChainExpiry(now, now);
    expect(next.getTime() - now.getTime()).toBe(48 * HOUR);
  });

  it("stacks correctly across multiple uses (3h -> 51h -> 99h -> 147h)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    let exp: Date = new Date(now.getTime() + 3 * HOUR);
    exp = extendChainExpiry(exp, now); // 51h
    exp = extendChainExpiry(exp, now); // 99h
    exp = extendChainExpiry(exp, now); // 147h
    expect(exp.getTime() - now.getTime()).toBe(147 * HOUR);
  });

  it("handles fractional remaining hours", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const current = new Date(now.getTime() + 90 * 60 * 1000); // 1.5h
    const next = extendChainExpiry(current, now);
    expect(next.getTime() - current.getTime()).toBe(48 * HOUR);
  });
});
