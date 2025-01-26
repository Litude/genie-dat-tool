import { asUInt8, UInt8 } from "../Types";

export type ObjectType = UInt8;

// Note: In early versions, these values are divided by 10 as the middle types do not exist!
export const ObjectTypes = {
    None: asUInt8(0),
    Scenery: asUInt8(10),
    TreeAoK: asUInt8(15),
    Animated: asUInt8(20),
    Doppelganger: asUInt8(25),
    Mobile: asUInt8(30),
    Actor: asUInt8(40),
    Combatant: asUInt8(50),
    Projectile: asUInt8(60),
    AdvancedCombatant: asUInt8(70),
    Building: asUInt8(80),
    TreeAoE: asUInt8(90),
}
