import { describe, expect, it } from "vitest";
import {
  bowditchAdjust,
  decimalToDMS,
  normalizeDeg,
  parseAngle,
  polarToCartesian,
  traverseCoordinates,
} from "../src/core/SurveyEngine";

describe("angles", () => {
  it("normalizes negative and large angles", () => {
    expect(normalizeDeg(-10)).toBeCloseTo(350);
    expect(normalizeDeg(725)).toBeCloseTo(5);
  });
  it("formats DMS and carries rounded seconds", () => {
    expect(decimalToDMS(123.5025)).toBe("123-30-09");
    expect(decimalToDMS(10.99999)).toBe("011-00-00");
  });
  it("parses decimal and DMS", () => {
    expect(parseAngle("45.5")).toBe(45.5);
    expect(parseAngle("123-30-09")).toBeCloseTo(123.5025, 4);
  });
  it("rejects garbage", () => {
    expect(() => parseAngle("abc")).toThrow();
  });
});

describe("polarToCartesian", () => {
  it("shoots due east on level ground", () => {
    const p = polarToCartesian({ northing: 100, easting: 100, elevation: 50 }, 0, {
      horizontalAngle: 90, verticalAngle: 90, slopeDistance: 10, instrumentHeight: 1.5, rodHeight: 1.5,
    });
    expect(p.northing).toBeCloseTo(100);
    expect(p.easting).toBeCloseTo(110);
    expect(p.elevation).toBeCloseTo(50);
  });
  it("handles a negative backsight bearing", () => {
    const p = polarToCartesian({ northing: 0, easting: 0, elevation: 0 }, -90, {
      horizontalAngle: 0, verticalAngle: 90, slopeDistance: 10, instrumentHeight: 0, rodHeight: 0,
    });
    expect(p.easting).toBeCloseTo(-10);
  });
});

describe("bowditchAdjust", () => {
  // 100 m square with a small error on the last leg.
  const legs = [
    { fromId: 1, toId: 2, bearingDeg: 0, length: 100 },
    { fromId: 2, toId: 3, bearingDeg: 90, length: 100 },
    { fromId: 3, toId: 4, bearingDeg: 180, length: 100 },
    { fromId: 4, toId: 1, bearingDeg: 270, length: 99.9 },
  ];
  it("computes misclosure and precision", () => {
    const r = bowditchAdjust(legs);
    expect(r.linearMisclosure).toBeCloseTo(0.1);
    expect(r.perimeter).toBeCloseTo(399.9);
    expect(r.precisionRatio).toBeCloseTo(3999, 0);
  });
  it("closes exactly after adjustment", () => {
    const r = bowditchAdjust(legs);
    const pts = traverseCoordinates({ northing: 1000, easting: 1000, elevation: 0 }, r.adjustedLegs);
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(last.northing).toBeCloseTo(first.northing, 9);
    expect(last.easting).toBeCloseTo(first.easting, 9);
  });
  it("reports infinite precision for a perfect closure", () => {
    const r = bowditchAdjust(legs.map((l) => ({ ...l, length: 100 })));
    expect(r.precisionRatio).toBe(Infinity);
  });
});
