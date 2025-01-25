import BufferReader from "../../BufferReader"
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined } from "../../ts/ts-utils";
import { Civilization } from "../Civilization";
import { LoadingContext } from "../LoadingContext"
import { SavingContext } from "../SavingContext";
import { asInt16, asInt32, Bool32 } from "../Types";
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
                object.readFromBuffer(buffer, asInt16(i), loadingContext);
                object.objectType = objectType;
            }
        }
        result.push(object);
    }
    return result;
}


export function writObjectPrototypesToWorldTextFile(civilizations: Civilization[], prototypes: (SceneryObjectPrototype | null)[][], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.Objects);
    textFileWriter.raw(civilizations.length).eol(); // civilization count
    const civilizationObjects = civilizations.map((civilization, index) => ({
        civilization,
        objects: prototypes[index].filter(isDefined).sort((a, b) => textFileStringCompare(a.internalName, b.internalName)),
        totalObjectCount: asInt32(prototypes[index].length),
    })).sort((a, b) => textFileStringCompare(a.civilization.internalName, b.civilization.internalName))
    
    civilizationObjects.forEach(civObject => {
        textFileWriter
            .integer(civObject.civilization.id)
            .integer(civObject.totalObjectCount)
            .integer(asInt32(civObject.objects.length))
            .eol();
        
        civObject.objects.forEach(object => {
            object.writeToTextFile(textFileWriter, savingContext);
        });
    })

    textFileWriter.close();

}
