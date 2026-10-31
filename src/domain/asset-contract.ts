import type { Dimensions3D, Vector3Meters } from "./measurements";

export type AssetFormat = "glb" | "gltf";
export type AssetLicense = "CC0-1.0" | "CC-BY-4.0" | "CC-BY-NC-4.0" | "UNVERIFIED";
export type AssetOrigin = "base-center" | "footprint-center" | "wall-mount" | "custom";

export interface AssetClearance {
  front?: number;
  rear?: number;
  left?: number;
  right?: number;
  above?: number;
  status: "verified" | "assumed" | "unknown";
}

export interface AssetPort {
  id: string;
  kind: "water" | "drain" | "electrical" | "exhaust" | "data" | "safety" | "other";
  position: Vector3Meters;
  direction?: Vector3Meters;
}

export interface LaboratoryAssetDefinition {
  id: string;
  name: string;
  category: "furniture" | "infrastructure" | "equipment" | "safety";
  sourceRepository: string;
  sourcePath: string;
  license: AssetLicense;
  attribution: string;
  format: AssetFormat;
  sourceUnits: "m" | "ft";
  dimensionsMeters: Dimensions3D;
  origin: AssetOrigin;
  frontAxis: "+X" | "-X" | "+Z" | "-Z";
  modelUrl: string;
  lowDetailModelUrl?: string;
  thumbnailUrl?: string;
  clearance?: AssetClearance;
  ports?: AssetPort[];
  collisionProfile: "bounds" | "custom";
  sourceVerified: boolean;
}
