import { z } from "zod";
import { Point } from "./Point";

export interface Rectangle<T> {
  left: T;
  top: T;
  right: T;
  bottom: T;
}

export function movedRectangle<T extends number, Y extends number>(
  rectangle: Rectangle<T>,
  offset: Point<Y>,
) {
  return {
    left: (rectangle.left + offset.x) as T,
    right: (rectangle.right + offset.x) as T,
    top: (rectangle.top + offset.y) as T,
    bottom: (rectangle.bottom + offset.y) as T,
  };
}

export function unionRectangle<T extends number>(
  first: Rectangle<T>,
  second: Rectangle<T>,
) {
  return {
    left: Math.min(first.left, second.left),
    right: Math.max(first.right, second.right),
    top: Math.min(first.top, second.top),
    bottom: Math.max(first.bottom, second.bottom),
  };
}

export const RectangleSchema = <T extends number>(schemaType: z.Schema<T>) => {
  return z.object({
    left: schemaType,
    top: schemaType,
    right: schemaType,
    bottom: schemaType,
  });
};
