import semver from 'semver';
import BufferReader from "../../BufferReader"
import isEqual from "fast-deep-equal";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined, Nullable } from "../../ts/ts-utils";
import { Civilization } from "../Civilization";
import { LoadingContext } from "../LoadingContext"
import { SavingContext } from "../SavingContext";
import { asInt16, asInt32, asUInt8, Bool32 } from "../../ts/base-types";
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
import path from 'path';
import { clearDirectory } from '../../files/file-utils';
import { createJson, oldTransformObjectToJson, writeJsonFileIndex } from '../../json/json-serialization';
import { writeFileSync } from 'fs';

export type BaseObjectPrototype = SceneryObjectPrototype;

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


export function writeObjectPrototypesToWorldTextFile(outputDirectory: string, civilizations: Civilization[], prototypes: (SceneryObjectPrototype | null)[][], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.ObjectPrototypes));
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

function mergeCommonFields<T>(values: T[]): T {
    if (values.every((v) => typeof v !== "object" || v === null)) {
        return mostCommonValue(values); // Handle primitive values
    }
    else {
        // Need to return the original value because this comparison destroys...
        const simplifiedEntries = values.map(x => JSON.stringify(x));
        const result = mostCommonValue(simplifiedEntries);
        const resultIndex = simplifiedEntries.indexOf(result);
        return values[resultIndex];
    }
}

function mostCommonValue<T>(values: T[]): T {
    const freqMap = new Map<T, number>();

    for (const val of values) {
        freqMap.set(val, (freqMap.get(val) || 0) + 1);
    }

    return [...freqMap.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

// Circular structures need to be excluded
const excludedBaselineFields: (keyof BuildingObjectPrototype)[] = [
    "creationSound",
    "deadUnitPrototype",
    "placementNeighbouringTerrains",
    "placementUnderlyingTerrains",
    "habitat"
]

function reconstructInstances(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
        return obj.map(reconstructInstances);
    }

    if (typeof obj === "object" && Object.getPrototypeOf(obj) !== Object.prototype) {
        const newInstance = Object.create(Object.getPrototypeOf(obj));

        for (const key in obj) {
            newInstance[key] = reconstructInstances(obj[key]);
        }

        return newInstance;
    }

    return obj;
}

export function createBaselineObjectPrototypes(objectPrototypes: Nullable<SceneryObjectPrototype>[][]): Nullable<SceneryObjectPrototype>[] {
    const civilizationCount = objectPrototypes.length;
    const objectCount = objectPrototypes[0].length;
    const baselineObjects: Nullable<SceneryObjectPrototype>[] = []; //= Array.from({ length: rowCount }, () => Array(colCount).fill(null));
    for (let objectIndex = 0; objectIndex < objectCount; ++objectIndex) {
        const fieldValues: Record<string, any[]> = {};
        let objectInstance: SceneryObjectPrototype | null = null;
        for (let civilizationIndex = 0; civilizationIndex < civilizationCount; civilizationIndex++) {
            const instance = objectPrototypes[civilizationIndex][objectIndex];
            if (instance) {
                objectInstance = instance;
                // TODO: exclude reference fields and relink them later...
                for (const key of Object.keys(instance)) {
                    if (!excludedBaselineFields.includes(key as keyof SceneryObjectPrototype)) {
                        if (!fieldValues[key]) {
                            fieldValues[key] = [];
                        }
                        fieldValues[key].push(instance[key as keyof SceneryObjectPrototype]);
                    }
                }
            }
        }

        if (Object.keys(fieldValues).length) {

            const mostCommonFields: Partial<SceneryObjectPrototype> = {};
            for (const key in fieldValues) {
                mostCommonFields[key as keyof SceneryObjectPrototype] = mergeCommonFields(fieldValues[key]);
            }

            const baseLineObject = Object.assign(
                Object.create(Object.getPrototypeOf(objectInstance)),
                Object.fromEntries(
                    Object.entries(mostCommonFields).map(([key, value]) => [key, reconstructInstances(value)])
                )
            );
            baselineObjects.push(baseLineObject);
        }
        else {
            baselineObjects.push(null);
        }
    }

    return baselineObjects;


}

export function writeObjectPrototypesToJsonFiles(outputDirectory: string, baselineObjects: Nullable<SceneryObjectPrototype>[], objectPrototypes: Nullable<SceneryObjectPrototype>[][], savingContext: SavingContext) {

    const objectsDirectory = path.join(outputDirectory, "objects");

    const jsonBaselineObjects = baselineObjects.map(object => object ? oldTransformObjectToJson(object, object.getJsonConfig(), savingContext) : null);

    // Need to eliminate all fields that are not actually baseline (we require that more than half of civilizations actually share this value)
    const civilizationCount = objectPrototypes.length;
    const baselineEnableStates: boolean[] = [];
    const jsonObjects = objectPrototypes.map(civObjects => civObjects.map(object => object ? oldTransformObjectToJson(object, object.getJsonConfig(), savingContext) : null))
    for (let i = 0; i < jsonBaselineObjects.length; ++i) {
        let validEntryCount = 0;
        if (jsonBaselineObjects[i]) {
            jsonObjects.forEach(civObjects => {
                if (civObjects[i]) {
                    ++validEntryCount;
                }
            })
            Object.entries(jsonBaselineObjects[i]).forEach(([key, value]) => {
                let matchCount = 0;
                jsonObjects.forEach(civObjects => {
                    if (civObjects[i]) {
                        if (isEqual(civObjects[i][key], value)) {
                            ++matchCount;
                        }
                    }
                })
                if (matchCount / validEntryCount <= 0.5) {
                    jsonBaselineObjects[i][key] = undefined;
                }
            });
            baselineEnableStates.push((validEntryCount / civilizationCount) > 0.5);
        }
        else {
            baselineEnableStates.push(false);
        }
    }

    // Remove fields that match the baseline from civilization objects
    for (let i = 0; i < jsonBaselineObjects.length; ++i) {
        if (jsonBaselineObjects[i]) {
            Object.entries(jsonBaselineObjects[i]).forEach(([key, value]) => {
                if (value !== undefined) { // Only fields that we have "deleted" should be undefined, otherwise null is used. Fields that don't exist in the baseline should be kept
                    jsonObjects.forEach(civObjects => {
                        if (civObjects[i] && isEqual(civObjects[i][key], value)) {
                            delete civObjects[i][key];
                        }
                    })
                }
            });
        }
    }

    const mergedJsonObjects = jsonBaselineObjects.map((baselineObject, objIndex) => baselineObject ? ({
        baseline: { enabled: baselineEnableStates[objIndex], ...baselineObject },
        overrides: jsonObjects.reduce((acc, curCiv, civIndex) => {
            const enabledStateDiffers = Boolean(curCiv[objIndex]) != baselineEnableStates[objIndex]
            if (curCiv[objIndex] && Object.keys(curCiv[objIndex]).length) {
                acc[civIndex] = enabledStateDiffers ? { enabled: Boolean(curCiv[objIndex]), ...curCiv[objIndex] } : curCiv[objIndex];
            }
            else if (enabledStateDiffers) {
                acc[civIndex] = { enabled: Boolean(curCiv[objIndex]) };
            }
            return acc;
        }, {} as Record<number, any>)
    }) : null)

    clearDirectory(objectsDirectory);
    mergedJsonObjects.forEach((jsonObject, index) => {
        if (jsonObject) {
            writeFileSync(path.join(objectsDirectory, `${baselineObjects[index]?.referenceId}.json`), createJson(jsonObject));
        }
    })
    
    writeJsonFileIndex(objectsDirectory, baselineObjects);
}
