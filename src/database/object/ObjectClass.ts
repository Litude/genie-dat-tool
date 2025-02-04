import { asInt16, Int16 } from "../../ts/base-types";

export type ObjectClass = Int16;

export const ObjectClasses = {
    None: asInt16(-1),

    Fish: asInt16(5),

    ForageFruit: asInt16(7),
    StoneOrGoldMine: asInt16(8), // Note: Older versions have gold with the same class so here this is a generic mine type!
    StoneMine: asInt16(8),
    Miscellaneous: asInt16(11),

    Tree: asInt16(15),

    GoldMine: asInt16(32)
}
