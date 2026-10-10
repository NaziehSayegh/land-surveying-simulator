// Coordinate geometry core. Pure functions on plain data, no dependencies.

export interface Coordinate {
  northing: number;
  easting: number;
  elevation: number;
}

export interface PolarObservation {
  horizontalAngle: number; // decimal degrees, clockwise from backsight
  verticalAngle: number; // decimal degrees, zenith angle (90 = horizontal)
  slopeDistance: number; // meters
  instrumentHeight: number; // meters
  rodHeight: number; // meters
}

export interface TraverseLeg {
  fromId: number;
  toId: number;
  bearingDeg: number;
  length: number;
}

export interface AdjustedLeg extends TraverseLeg {
  departure: number;
  latitude: number;
  correctedDeparture: number;
  correctedLatitude: number;
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/** Wrap any angle into [0, 360). */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Polar shot (angle/distance) to a Cartesian coordinate. */
export function polarToCartesian(
  occupied: Coordinate,
  backsightBearingDeg: number,
  obs: PolarObservation,
): Coordinate {
  const bearingRad = degToRad(normalizeDeg(backsightBearingDeg + obs.horizontalAngle));
  const vertRad = degToRad(obs.verticalAngle);

  const horizontalDist = obs.slopeDistance * Math.sin(vertRad);
  const verticalDist = obs.slopeDistance * Math.cos(vertRad);

  return {
    northing: occupied.northing + horizontalDist * Math.cos(bearingRad),
    easting: occupied.easting + horizontalDist * Math.sin(bearingRad),
    elevation: occupied.elevation + verticalDist + obs.instrumentHeight - obs.rodHeight,
  };
}

/** Decimal degrees to DDD-MM-SS, carrying rounded seconds correctly. */
export function decimalToDMS(deg: number): string {
  const sign = deg < 0 ? "-" : "";
  let totalSeconds = Math.round(Math.abs(deg) * 3600);
  const d = Math.floor(totalSeconds / 3600);
  totalSeconds -= d * 3600;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${sign}${pad(d, 3)}-${pad(m, 2)}-${pad(s, 2)}`;
}

/** Parse "123.5025" or "123-30-09" (DDD-MM-SS) to decimal degrees. */
export function parseAngle(text: string): number {
  const t = text.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = /^(-?)(\d+)-(\d+)(?:-(\d+(?:\.\d+)?))?$/.exec(t);
  if (!m) throw new Error(`Cannot read angle "${text}"`);
  const value = Number(m[2]) + Number(m[3]) / 60 + Number(m[4] ?? 0) / 3600;
  return m[1] ? -value : value;
}

/** Bowditch (Compass) Rule adjustment of a closed traverse. */
export function bowditchAdjust(legs: TraverseLeg[]): {
  adjustedLegs: AdjustedLeg[];
  misclosureNorth: number;
  misclosureEast: number;
  linearMisclosure: number;
  perimeter: number;
  precisionRatio: number; // the N in 1:N
} {
  const perimeter = legs.reduce((sum, l) => sum + l.length, 0);

  const raw = legs.map((l) => {
    const rad = degToRad(l.bearingDeg);
    return { ...l, departure: l.length * Math.sin(rad), latitude: l.length * Math.cos(rad) };
  });

  const sumDeparture = raw.reduce((s, l) => s + l.departure, 0);
  const sumLatitude = raw.reduce((s, l) => s + l.latitude, 0);
  const linearMisclosure = Math.hypot(sumDeparture, sumLatitude);

  const adjustedLegs: AdjustedLeg[] = raw.map((l) => {
    const share = perimeter > 0 ? l.length / perimeter : 0;
    return {
      ...l,
      correctedDeparture: l.departure - sumDeparture * share,
      correctedLatitude: l.latitude - sumLatitude * share,
    };
  });

  return {
    adjustedLegs,
    misclosureNorth: sumLatitude,
    misclosureEast: sumDeparture,
    linearMisclosure,
    perimeter,
    precisionRatio: linearMisclosure > 1e-9 ? perimeter / linearMisclosure : Infinity,
  };
}

/** Walk adjusted legs from a start point; returns one coordinate per station (start first). */
export function traverseCoordinates(
  start: Coordinate,
  legs: AdjustedLeg[],
): { id: number; northing: number; easting: number }[] {
  const pts = [{ id: legs[0]?.fromId ?? 1, northing: start.northing, easting: start.easting }];
  let n = start.northing;
  let e = start.easting;
  for (const l of legs) {
    n += l.correctedLatitude;
    e += l.correctedDeparture;
    pts.push({ id: l.toId, northing: n, easting: e });
  }
  return pts;
}
