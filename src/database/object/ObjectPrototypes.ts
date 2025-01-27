import semver from 'semver';
import BufferReader from "../../BufferReader"
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined } from "../../ts/ts-utils";
import { Civilization } from "../Civilization";
import { LoadingContext } from "../LoadingContext"
import { SavingContext } from "../SavingContext";
import { asInt16, asInt32, asUInt8, Bool32 } from "../Types";
import { ActorObjectPrototype } from "./ActorObjectPrototype";
import { AdvancedCombatantObjectPrototype } from "./AdvancedCombatantObjectPrototype";
import { AnimatedObjectPrototype } from "./AnimatedObjectPrototype";
import { BuildingObjectPrototype } from "./BuildingObjectPrototype";
import { CombatantObjectPrototype } from "./CombatantObjectPrototype";
import { DoppelgangerObjectPrototype } from "./DoppelgangerObjectPrototype";
import { MobileObjectPrototype } from "./MobileObjectPrototype";
import { ObjectTypes } from "./ObjectType";
import { ProjectileObjectPrototype } from "./ProjectileObjectPrototype";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";
import { TreeObjectPrototype } from "./TreeObjectPrototype";
import { ParsingError } from '../Error';

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
            let objectType = buffer.readUInt8();
            if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
                objectType = asUInt8(Math.round(objectType * 10));
            }
            switch (objectType) {
                case ObjectTypes.Scenery:
                    object = new SceneryObjectPrototype();
                    break;
                case ObjectTypes.Animated:
                    object = new AnimatedObjectPrototype();
                    break;
                case ObjectTypes.Doppelganger:
                    object = new DoppelgangerObjectPrototype();
                    break;
                case ObjectTypes.Mobile:
                    object = new MobileObjectPrototype();
                    break;
                case ObjectTypes.Actor:
                    object = new ActorObjectPrototype();
                    break;
                case ObjectTypes.Combatant:
                    object = new CombatantObjectPrototype();
                    break;
                case ObjectTypes.Projectile:
                    object = new ProjectileObjectPrototype();
                    break;
                case ObjectTypes.AdvancedCombatant:
                    object = new AdvancedCombatantObjectPrototype();
                    break;
                case ObjectTypes.Building:
                    object = new BuildingObjectPrototype();
                    break;
                case ObjectTypes.TreeAoE:
                case ObjectTypes.TreeAoK:
                    object = new TreeObjectPrototype();
                    break;
                default:
                    break;
            }
            if (!object) {
                throw new ParsingError(`Received unknown object type ${objectType} when reading units!`);
            }
            else {
                object.objectType = objectType;
                object.readFromBuffer(buffer, asInt16(i), loadingContext);
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
