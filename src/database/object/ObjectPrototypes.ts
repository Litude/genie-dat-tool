import JSON5 from "json5";
import semver from 'semver';
import BufferReader from "../../BufferReader"
import isEqual from "fast-deep-equal";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { forEachObjectEntry, isDefined, Nullable } from "../../ts/ts-utils";
import { Civilization } from "../Civilization";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext"
import { SavingContext } from "../SavingContext";
import { asInt16, asInt32, asUInt8, Bool32, Int16 } from "../../ts/base-types";
import { ActorObjectPrototype, ActorObjectPrototypeSchema } from "./ActorObjectPrototype";
import { AdvancedCombatantObjectPrototype, AdvancedCombatantObjectPrototypeSchema } from "./AdvancedCombatantObjectPrototype";
import { AnimatedObjectPrototype, AnimatedObjectPrototypeSchema } from "./AnimatedObjectPrototype";
import { BuildingObjectPrototype, BuildingObjectPrototypeSchema } from "./BuildingObjectPrototype";
import { CombatantObjectPrototype, CombatantObjectPrototypeSchema } from "./CombatantObjectPrototype";
import { DoppelgangerObjectPrototype } from "./DoppelgangerObjectPrototype";
import { MobileObjectPrototype, MobileObjectPrototypeSchema } from "./MobileObjectPrototype";
import { ObjectType, ObjectTypes } from "./ObjectType";
import { ProjectileObjectPrototype, ProjectileObjectPrototypeSchema } from "./ProjectileObjectPrototype";
import { SceneryObjectPrototype, SceneryObjectPrototypeJson, SceneryObjectPrototypeSchema } from "./SceneryObjectPrototype";
import { TreeObjectPrototype } from "./TreeObjectPrototype";
import { ParsingError } from '../Error';
import path from 'path';
import { clearDirectory } from '../../files/file-utils';
import { createJson, readJsonFileIndex, writeJsonFileIndex } from '../../json/json-serialization';
import { readFileSync, writeFileSync } from 'fs';
import { z } from "zod";
import { PrototypeId } from "../Types";

export type BaseObjectPrototype = SceneryObjectPrototype;
export type BaseObjectPrototypeJson = SceneryObjectPrototypeJson;
const BaseObjectPrototypeSchema = SceneryObjectPrototypeSchema;

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
            let objectType = buffer.readUInt8<ObjectType>();
            if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
                objectType = asUInt8<ObjectType>(Math.round(objectType * 10));
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
    const baselineObjects: Nullable<SceneryObjectPrototype>[] = [];
    for (let objectIndex = 0; objectIndex < objectCount; ++objectIndex) {
        const fieldValues: Record<string, any[]> = {};
        let objectInstance: SceneryObjectPrototype | null = null;
        for (let civilizationIndex = 0; civilizationIndex < civilizationCount; civilizationIndex++) {
            const instance = objectPrototypes[civilizationIndex][objectIndex];
            if (instance) {
                objectInstance = instance;
                // References should not be linked yet when this function is called!
                for (const key of Object.keys(instance)) {
                    if (!fieldValues[key]) {
                        fieldValues[key] = [];
                    }
                    fieldValues[key].push(instance[key as keyof SceneryObjectPrototype]);
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

export function writeObjectPrototypesToJsonFiles(outputDirectory: string, baselineObjects: Nullable<BaseObjectPrototype>[], objectPrototypes: Nullable<BaseObjectPrototype>[][], savingContext: SavingContext) {

    const objectsDirectory = path.join(outputDirectory, "objects");

    const jsonBaselineObjects: Nullable<Partial<BaseObjectPrototypeJson>>[] = baselineObjects.map(object => object ? object.toJson(savingContext) : null);

    // Need to eliminate all fields that are not actually baseline (we require that more than half of civilizations actually share this value)
    const civilizationCount = objectPrototypes.length;
    const baselineEnableStates: boolean[] = [];
    const jsonObjects: Nullable<Partial<BaseObjectPrototypeJson>>[][] = objectPrototypes.map(civObjects => civObjects.map(object => object ? object.toJson(savingContext) : null))
    for (let i = 0; i < jsonBaselineObjects.length; ++i) {
        let validEntryCount = 0;
        const baselineObject = jsonBaselineObjects[i];
        if (baselineObject) {
            jsonObjects.forEach(civObjects => {
                if (civObjects[i]) {
                    ++validEntryCount;
                }
            })
            forEachObjectEntry(baselineObject, (key, value) => {
                let matchCount = 0;
                jsonObjects.forEach(civObjects => {
                    const civObject = civObjects[i];
                    if (civObject) {
                        if (isEqual(civObject[key], value)) {
                            ++matchCount;
                        }
                    }
                })
                if (matchCount / validEntryCount <= 0.5) {
                    baselineObject[key] = undefined;
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
        const baselineObject = jsonBaselineObjects[i];
        if (baselineObject) {
            forEachObjectEntry(baselineObject, (key, value) => {
                if (value !== undefined) { // Only fields that we have "deleted" should be undefined, otherwise null is used. Fields that don't exist in the baseline should be kept
                    jsonObjects.forEach(civObjects => {
                        const civObject = civObjects[i];
                        if (civObject && isEqual(civObject[key], value)) {
                            delete civObject[key];
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

const MergedObjectSchema = z.object({
    baseline: SceneryObjectPrototypeSchema.merge(z.object({
        enabled: z.boolean(),
    })).partial().passthrough(),
    overrides: z.record(z.string().regex(/^\d+$/), SceneryObjectPrototypeSchema.merge(z.object({
        enabled: z.boolean(),
    })).partial().passthrough())
});

export function readObjectPrototypesFromJsonFiles(inputDirectory: string, prototypeIds: (string | null)[], civilizationCount: number, loadingContext: JsonLoadingContext) {
    const objectsDirectory = path.join(inputDirectory, 'objects');
    const civilizationObjects: Nullable<BaseObjectPrototype>[][] = Array.from({ length: civilizationCount }, () => []);
    prototypeIds.forEach((objectPrototypeReferenceId, objectPrototypeNumberId) => {
        if (objectPrototypeReferenceId === null) {
            for (let i = 0; i < civilizationCount; ++i) {
                civilizationObjects[i].push(null);
            }
        }
        else {
            const rawObject = MergedObjectSchema.parse(JSON5.parse(readFileSync(path.join(objectsDirectory, `${objectPrototypeReferenceId}.json`)).toString('utf8')));
            for (let i = 0; i < civilizationCount; ++i) {
                const fullCivilizationObject = Object.assign({}, rawObject.baseline, rawObject.overrides[i] ?? {})
                const { enabled, ...civilizationObject } = fullCivilizationObject;
                if (enabled) {
                    const objectType = civilizationObject.objectType;
                    switch (objectType) {
                        case ObjectTypes.Scenery: {
                            const objectJson = SceneryObjectPrototypeSchema.parse(civilizationObject);
                            const object = new SceneryObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case ObjectTypes.TreeAoE:
                        case ObjectTypes.TreeAoE: {
                            const objectJson = SceneryObjectPrototypeSchema.parse(civilizationObject);
                            const object = new TreeObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case ObjectTypes.Animated: {
                            const objectJson = AnimatedObjectPrototypeSchema.parse(civilizationObject);
                            const object = new AnimatedObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case ObjectTypes.Doppelganger:
                            const objectJson = AnimatedObjectPrototypeSchema.parse(civilizationObject);
                            const object = new DoppelgangerObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        case ObjectTypes.Mobile: {
                            const objectJson = MobileObjectPrototypeSchema.parse(civilizationObject);
                            const object = new MobileObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case ObjectTypes.Actor: {
                            const objectJson = ActorObjectPrototypeSchema.parse(civilizationObject);
                            const object = new ActorObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case ObjectTypes.Combatant: {
                            const objectJson = CombatantObjectPrototypeSchema.parse(civilizationObject);
                            const object = new CombatantObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case ObjectTypes.Projectile: {
                            const objectJson = ProjectileObjectPrototypeSchema.parse(civilizationObject);
                            const object = new ProjectileObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case ObjectTypes.AdvancedCombatant: {
                            const objectJson = AdvancedCombatantObjectPrototypeSchema.parse(civilizationObject);
                            const object = new AdvancedCombatantObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case ObjectTypes.Building: {
                            const objectJson = BuildingObjectPrototypeSchema.parse(civilizationObject);
                            const object = new BuildingObjectPrototype();
                            object.readFromJsonFile(objectJson, asInt16<PrototypeId<Int16>>(objectPrototypeNumberId), objectPrototypeReferenceId, loadingContext);
                            civilizationObjects[i].push(object);
                            break;
                        }
                        case undefined:
                            throw new Error(`Object ${objectPrototypeReferenceId} for civilization ${i} has no objectType!`)
                        default:
                            throw new Error(`Unrecognized object type ${objectType} for ${objectPrototypeReferenceId} (civilization ${i})`);
                    }
                }
                else {
                    civilizationObjects[i].push(null);
                }
            }
        }

    })
    return civilizationObjects;
}

export function readObjectPrototypeIdsFromJsonIndex(inputDirectory: string) {
    return readJsonFileIndex(path.join(inputDirectory, "objects"));
}
