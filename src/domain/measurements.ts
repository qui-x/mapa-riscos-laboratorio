export type LengthUnit = "m" | "ft";

export const METERS_PER_FOOT = 0.3048;

export interface Dimensions3D {
  width: number;
  height: number;
  depth: number;
}

export interface Vector3Meters {
  x: number;
  y: number;
  z: number;
}

/**
 * Converte comprimentos entre metros e pés.
 * A camada 3D usará metros internamente; fontes externas podem usar pés.
 */
export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("A medida precisa ser um número finito.");
  }

  if (from === to) return value;

  const meters = from === "ft" ? value * METERS_PER_FOOT : value;
  return to === "ft" ? meters / METERS_PER_FOOT : meters;
}

export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new TypeError("O ângulo precisa ser um número finito.");
  }

  return ((degrees % 360) + 360) % 360;
}

export function assertPositiveDimensions(dimensions: Dimensions3D): Dimensions3D {
  const values = [dimensions.width, dimensions.height, dimensions.depth];

  if (values.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError("Largura, altura e profundidade precisam ser positivas.");
  }

  return { ...dimensions };
}
