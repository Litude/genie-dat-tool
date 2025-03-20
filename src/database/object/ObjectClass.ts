import { z } from "zod";
import { asInt16, Int16, Int16Schema } from "../../ts/base-types";

export type ObjectClass = Int16 & { __type: "ObjectClass" };
export const ObjectClassSchema: z.Schema<ObjectClass> =
  Int16Schema as z.Schema<ObjectClass>;

export const ObjectClasses = {
  None: asInt16<ObjectClass>(-1),

  Fish: asInt16<ObjectClass>(5),

  ForageFruit: asInt16<ObjectClass>(7),
  StoneOrGoldMine: asInt16<ObjectClass>(8), // Note: Older versions have gold with the same class so here this is a generic mine type!
  StoneMine: asInt16<ObjectClass>(8),
  Miscellaneous: asInt16<ObjectClass>(11),

  Tree: asInt16<ObjectClass>(15),

  GoldMine: asInt16<ObjectClass>(32),
};
