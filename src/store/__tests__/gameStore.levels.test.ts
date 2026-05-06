import { describe, it, expect } from "vitest";
import {
  LEVELS,
  getCurrentLevel,
  getNextLevel,
  getMentsToNextLevel,
  getLevelProgress,
} from "@/store/gameStore";

describe("LEVELS table", () => {
  it("has 25 contiguous tiers with no gaps", () => {
    expect(LEVELS).toHaveLength(25);
    for (let i = 0; i < LEVELS.length - 1; i++) {
      expect(LEVELS[i + 1].minMents).toBe(LEVELS[i].maxMents + 1);
    }
  });

  it("ends at infinity for the final tier", () => {
    expect(LEVELS[24].level).toBe(25);
    expect(LEVELS[24].maxMents).toBe(Infinity);
  });
});

describe("getCurrentLevel boundaries", () => {
  it("returns L1 at 0 sent", () => {
    expect(getCurrentLevel(0).level).toBe(1);
  });
  it("L1 covers 19, L2 starts at 20", () => {
    expect(getCurrentLevel(19).level).toBe(1);
    expect(getCurrentLevel(20).level).toBe(2);
  });
  it("L5 covers 99, L6 starts at 100", () => {
    expect(getCurrentLevel(99).level).toBe(5);
    expect(getCurrentLevel(100).level).toBe(6);
  });
  it("L24 covers 2499, L25 starts at 2500", () => {
    expect(getCurrentLevel(2499).level).toBe(24);
    expect(getCurrentLevel(2500).level).toBe(25);
  });
  it("L25 holds at very large totals", () => {
    expect(getCurrentLevel(999_999).level).toBe(25);
  });
});

describe("getNextLevel", () => {
  it("returns L2 reward when at L1", () => {
    expect(getNextLevel(0)?.level).toBe(2);
  });
  it("returns undefined at the legendary cap (L25)", () => {
    expect(getNextLevel(2500)).toBeUndefined();
    expect(getNextLevel(999_999)).toBeUndefined();
  });
});

describe("getLevelProgress", () => {
  it("is 0% at the start of a tier", () => {
    expect(getLevelProgress(0)).toBe(0);
    expect(getLevelProgress(20)).toBe(0);
  });
  it("is 100% at the end of a tier (max inclusive)", () => {
    // L1: 0..19, range = 20, at 19 -> 19/20 then we cross at 20
    expect(getLevelProgress(19)).toBeCloseTo(95);
  });
});

describe("getMentsToNextLevel", () => {
  it("counts down to the next tier", () => {
    // L1 maxMents=19; at totalSent=0 -> 20 to go
    expect(getMentsToNextLevel(0)).toBe(20);
    // at 19 -> 1 to go
    expect(getMentsToNextLevel(19)).toBe(1);
  });
});
