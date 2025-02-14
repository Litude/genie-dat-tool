import { z } from "zod";

export interface Point<T> {
  x: T;
  y: T;
}

export interface Point3D<T> {
  x: T;
  y: T;
  z: T;
}

export const PointSchema = <T extends number>(schemaType: z.Schema<T>) => {
  return z.object({
    x: schemaType,
    y: schemaType,
  });
};

export const Point3DSchema = <T extends number>(schemaType: z.Schema<T>) => {
  return z.object({
    x: schemaType,
    y: schemaType,
    z: schemaType,
  });
};
