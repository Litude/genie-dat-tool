import { z } from "zod";

export interface Rectangle<T> {
  left: T;
  top: T;
  right: T;
  bottom: T;
}

export const RectangleSchema = <T extends number>(schemaType: z.Schema<T>) => {
  return z.object({
    left: schemaType,
    top: schemaType,
    right: schemaType,
    bottom: schemaType,
  });
};
