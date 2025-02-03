import semver from "semver";
import { LoadingContext } from "../database/LoadingContext";
import { SavingContext } from "../database/SavingContext";
import { Nullable } from "../ts/ts-utils";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { writeFileSync } from "fs";
import { z } from "zod";
import { Float32, Int16, Int32, Int8, UInt16, UInt32, UInt8 } from "../database/Types";

export const uint8Schema: z.Schema<UInt8> = z.number()
  .int()
  .min(0, { message: "Number must be positive (uint8)"})
  .max(255, { message: "Number must be at most 255 (uint8)"}) as any;

export const uint16Schema: z.Schema<UInt16> = z.number()
    .int()
    .min(0, { message: "Number must be positive (uint16)"})
    .max(65535, { message: "Number must be at most 65535 (uint16)"}) as any;

export const uint32Schema: z.Schema<UInt32> = z.number()
    .int()
    .min(0, { message: "Number must be positive (uint32)"})
    .max(4294967295, { message: "Number must be at most 4294967295 (uint32)"}) as any;

export const int8Schema: z.Schema<Int8> = z.number()
    .int()
    .min(-128, { message: "Number must be at least -128 (int8)" })
    .max(127, { message: "Number must be at most 127 (int8)" }) as any;

export const int16Schema: z.Schema<Int16> = z.number()
  .int()
  .min(-32768, { message: "Number must be at least -32768 (int16)" })
  .max(32767, { message: "Number must be at most 32767 (int16)" }) as any;

export const int32Schema: z.Schema<Int32> = z.number()
  .int()
  .min(-2147483648, { message: "Number must be at least -2147483648 (int32)" })
  .max(2147483647, { message: "Number must be at most 2147483647 (int32)" }) as any;

export const float32Schema: z.Schema<Float32> = z.number() as any;

// TODO: Is there a risk that we get some other value than what it was originally when reading back these values?
// Need to read them back using Math.fround and probably check the data to see if errors accumulate..
function jsonNumberCleanup(key: string, value: any) {
    return typeof value === "number" ? parseFloat(value.toFixed(6)) : value
}

export function createJson(value: any) {
    return JSON.stringify(value, jsonNumberCleanup, 4);
}

export function writeJsonFileIndex(outputDirectory: string, entries: ({ referenceId: string} | null)[]) {
    const referenceIds = entries.map(entry => entry?.referenceId ?? null);
    writeFileSync(path.join(outputDirectory, "index.json"), createJson(referenceIds));
}

type SimpleFieldMapping<ObjectType, JsonType> = {
    field: keyof ObjectType & keyof JsonType;
    objectField?: never;
    jsonField?: never;
    toJson?: never;
    fromJson?: never;
}

type FromJsonMapping<ObjectType, JsonType> = {
    field?: never;
    objectField: keyof ObjectType;
    jsonField?: never;
    toJson?: never;
    fromJson: (
        obj: JsonType, 
        loadingContext: LoadingContext
    ) => JsonType extends { [K in keyof JsonType]: any } 
        ? (FromJsonMapping<ObjectType, JsonType> extends { objectField: infer OF }
            ? OF extends keyof ObjectType
                ? ObjectType[OF]
                : never
            : never)
        : never,
};

type ToJsonMapping<ObjectType, JsonType> = {
    field?: never;
    objectField?: never;
    jsonField: keyof JsonType;
    toJson: (
        obj: ObjectType, 
        savingContext: SavingContext
    ) => ObjectType extends { [K in keyof ObjectType]: any } 
        ? (ToJsonMapping<ObjectType, JsonType> extends { jsonField: infer JF }
            ? JF extends keyof JsonType
                ? JsonType[JF]
                : never
            : never)
        : never,
    fromJson?: never;
};

export type JsonFieldMapping<ObjectType, JsonType> = (SimpleFieldMapping<ObjectType, JsonType> | FromJsonMapping<ObjectType, JsonType> | ToJsonMapping<ObjectType, JsonType>) & {
    versionFrom?: string;
    versionTo?: string;
    flags?: {
        internalField?: boolean,
        unusedField?: boolean;
    },
    toCondition?: (obj: ObjectType, savingContext: SavingContext) => boolean,
    fromCondition?: (obj: JsonType, loadingContext: LoadingContext) => boolean,
}

export function transformObjectToJson<ObjectType extends object, JsonType extends object>(object: ObjectType, mappings: JsonFieldMapping<ObjectType, JsonType>[], savingContext: SavingContext): JsonType {
    const result: any = {};
    for (const fieldMapping of mappings) {
        if (
            (!fieldMapping.versionFrom || semver.gte(savingContext.version.numbering, fieldMapping.versionFrom)) &&
            (!fieldMapping.versionTo || semver.lte(savingContext.version.numbering, fieldMapping.versionTo)) &&
            (!fieldMapping.toCondition || fieldMapping.toCondition(object, savingContext)) &&
            (!fieldMapping.flags?.internalField || savingContext.internalFields) &&
            (!fieldMapping.flags?.unusedField || !savingContext.excludeUnused)
        ) {
            if (fieldMapping.field) {
                result[fieldMapping.field] = object[fieldMapping.field]
            }
            else if (fieldMapping.toJson) {
                result[fieldMapping.jsonField] = fieldMapping.toJson(object, savingContext);
            }
        }
    }
    return result;
}


export function writeDataEntryToJsonFile<ObjectType extends { referenceId: string }, JsonType extends object>(directoryPath: string, object: ObjectType, mappings: JsonFieldMapping<ObjectType, JsonType>[], savingContext: SavingContext) {
    const transformedData = transformObjectToJson(object, mappings, savingContext);
    writeFileSync(path.join(directoryPath, `${object.referenceId}.json`), createJson(transformedData));
}

export function writeDataEntriesToJson<ObjectType extends { referenceId: string }, JsonType extends object>(baseDirectory: string, dataDirectory: string, objects: Nullable<ObjectType>[], mappings: JsonFieldMapping<ObjectType, JsonType>[], savingContext: SavingContext) {
    const directoryPath = path.join(baseDirectory, dataDirectory);
    clearDirectory(directoryPath);

    objects.forEach(object => {
        if (object) {
            writeDataEntryToJsonFile(directoryPath, object, mappings, savingContext);
        }
    });
    
    writeJsonFileIndex(directoryPath, objects);
}


// deprecated
export type OldJsonFieldConfig<T> = {
    field: keyof T,
    versionFrom?: string;
    versionTo?: string;
    flags?: {
        internalField?: boolean,
        unusedField?: boolean;
    },
    toCondition?: (obj: T, savingContext: SavingContext) => boolean,
    fromCondition?: (obj: T, savingContext: SavingContext) => boolean,
    toJson?: (obj: T, savingContext: SavingContext) => any,
    fromJson?: (obj: T, loadingContext: LoadingContext) => any
}

// deprecated
export function oldTransformObjectToJson<T extends object>(object: T, config: OldJsonFieldConfig<T>[], savingContext: SavingContext) {
    const result: any = {};
    for (const field of config) {
        if (
            (!field.versionFrom || semver.gte(savingContext.version.numbering, field.versionFrom)) &&
            (!field.toCondition || field.toCondition(object, savingContext)) &&
            (!field.flags?.internalField || savingContext.internalFields) &&
            (!field.flags?.unusedField || !savingContext.excludeUnused)
        ) {
            result[field.field] = field.toJson ? field.toJson(object, savingContext) : (object as any)[field.field]
        }
    }
    return result;
}

// deprecated
export function oldWriteDataEntryToJsonFile<T extends { referenceId: string }>(directoryPath: string, object: T, config: OldJsonFieldConfig<T>[], savingContext: SavingContext) {
    const transformedData = oldTransformObjectToJson(object, config, savingContext);
    writeFileSync(path.join(directoryPath, `${object.referenceId}.json`), createJson(transformedData));
}

// deprecated
export function oldWriteDataEntriesToJson<T extends { referenceId: string }>(baseDirectory: string, dataDirectory: string, objects: Nullable<T>[], config: OldJsonFieldConfig<T>[], savingContext: SavingContext) {
    const directoryPath = path.join(baseDirectory, dataDirectory);
    clearDirectory(directoryPath);

    objects.forEach(object => {
        if (object) {
            oldWriteDataEntryToJsonFile(directoryPath, object, config, savingContext);
        }
    });
    
    writeJsonFileIndex(directoryPath, objects);
}
