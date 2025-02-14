import { z } from "zod";
import { asUInt8, UInt8, UInt8Schema } from "../../ts/base-types";

export type ObjectType = UInt8 & { __type: "ObjectType" };
export const ObjectTypeSchema: z.Schema<ObjectType> = UInt8Schema as any;

// Note: In early versions, these values are divided by 10 as the middle types do not exist!
export const ObjectTypes = {
  None: asUInt8<ObjectType>(0),
  Scenery: asUInt8<ObjectType>(10),
  TreeAoK: asUInt8<ObjectType>(15),
  Animated: asUInt8<ObjectType>(20),
  Doppelganger: asUInt8<ObjectType>(25),
  Mobile: asUInt8<ObjectType>(30),
  Actor: asUInt8<ObjectType>(40),
  Combatant: asUInt8<ObjectType>(50),
  Projectile: asUInt8<ObjectType>(60),
  AdvancedCombatant: asUInt8<ObjectType>(70),
  Building: asUInt8<ObjectType>(80),
  TreeAoE: asUInt8<ObjectType>(90),
};
