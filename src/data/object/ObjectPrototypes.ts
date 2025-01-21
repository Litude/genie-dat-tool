import BufferReader from "../../BufferReader"
import { LoadingContext } from "../LoadingContext"
import { Bool32 } from "../Types";
import { ActorObjectPrototype } from "./ActorObjectPrototype";
import { AdvancedCombatantObjectPrototype } from "./AdvancedCombatantObjectPrototype";
import { AnimatedObjectPrototype } from "./AnimatedObjectPrototype";
import { BuildingObjectPrototype } from "./BuildingObjectPrototype";
import { CombatantObjectPrototype } from "./CombatantObjectPrototype";
import { DoppelgangerObjectPrototype } from "./DoppelgangerObjectPrototype";
import { MobileObjectPrototype } from "./MobileObjectPrototype";
import { ObjectType } from "./ObjectType";
import { ProjectileObjectPrototype } from "./ProjectileObjectPrototype";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";
import { TreeObjectPrototype } from "./TreeObjectPrototype";

export function readObjectPrototypesFromBuffer(buffer: BufferReader, loadingContext: LoadingContext) {
    const result: (SceneryObjectPrototype | null)[] = [];
    const objectCount = buffer.readInt16();
    const validObjects: Bool32[] = [];
    for (let i = 0; i < objectCount; ++i) {
        validObjects.push(buffer.readBool32());
    }

    for (let i = 0; i < objectCount; ++i) {
        let object: SceneryObjectPrototype | null = null;
        if (validObjects[i]) {
            const objectType = buffer.readUInt8();
            switch (objectType) {
                case ObjectType.Scenery:
                    object = new SceneryObjectPrototype();
                    break;
                case ObjectType.Animated:
                    object = new AnimatedObjectPrototype();
                    break;
                case ObjectType.Doppelganger:
                    object = new DoppelgangerObjectPrototype();
                    break;
                case ObjectType.Mobile:
                    object = new MobileObjectPrototype();
                    break;
                case ObjectType.Actor:
                    object = new ActorObjectPrototype();
                    break;
                case ObjectType.Combatant:
                    object = new CombatantObjectPrototype();
                    break;
                case ObjectType.Projectile:
                    object = new ProjectileObjectPrototype();
                    break;
                case ObjectType.AdvancedCombatant:
                    object = new AdvancedCombatantObjectPrototype();
                    break;
                case ObjectType.Building:
                    object = new BuildingObjectPrototype();
                    break;
                case ObjectType.TreeAoE:
                case ObjectType.TreeAoK:
                    object = new TreeObjectPrototype();
                    break;
                default:
                    break;
            }
            if (!object) {
                throw new Error(`Received unknown object type ${objectType} when reading units!`);
            }
            else {
                object.readFromBuffer(buffer, loadingContext);
                object.objectType = objectType;
            }
        }
        result.push(object);
    }
    return result;
}
