import JSON5 from "json5";
import semver from "semver";
import { JsonLoadingContext, LoadingContext } from "../database/LoadingContext";
import { SavingContext } from "../database/SavingContext";
import { Nullable } from "../ts/ts-utils";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { readFileSync, writeFileSync } from "fs";
import { z } from "zod";

// TODO: Is there a risk that we get some other value than what it was originally when reading back these values?
// Need to read them back using Math.fround and probably check the data to see if errors accumulate..
function jsonNumberCleanup(_key: string, value: any) {
  return typeof value === "number" ? parseFloat(value.toFixed(6)) : value;
}

export function createJson(value: any) {
  return JSON.stringify(value, jsonNumberCleanup, 4);
}

export function writeJsonFileIndex(
  outputDirectory: string,
  entries: ({ referenceId: string } | null)[],
) {
  const referenceIds = entries.map((entry) => entry?.referenceId ?? null);
  writeFileSync(
    path.join(outputDirectory, "index.json"),
    createJson(referenceIds),
  );
}

export function readJsonFileIndex(inputDirectory: string) {
  const rawContents = readFileSync(
    path.join(inputDirectory, "index.json"),
  ).toString("utf-8");
  return z
    .array(z.union([z.string(), z.null()]))
    .parse(JSON5.parse(rawContents));
}

export function createMappingFromJsonFileIndex(input: (string | null)[]) {
  return input.reduce(
    (acc, cur, index) => ({ ...acc, ...(cur ? { [cur]: index } : {}) }),
    {} as Record<string, number>,
  );
}

type SimpleFieldMapping<ObjectType, JsonType> = {
  [K in keyof ObjectType & keyof JsonType]: [
    Extract<JsonType[K], undefined>,
  ] extends [never]
    ? [JsonType[K]] extends [ObjectType[K]]
      ? K
      : never
    : [Exclude<JsonType[K], undefined>] extends [ObjectType[K]]
      ? K
      : never;
}[keyof ObjectType & keyof JsonType] extends infer ValidField
  ? ValidField extends keyof ObjectType & keyof JsonType
    ? {
        field: ValidField;
        objectField?: never;
        jsonField?: never;
        toJson?: never;
        fromJson?: never;
      }
    : never
  : never;

type FromJsonMapping<ObjectType, JsonType> = {
  field?: never;
  objectField: keyof ObjectType;
  jsonField?: never;
  toJson?: never;
  fromJson: (
    json: JsonType,
    obj: ObjectType,
    loadingContext: JsonLoadingContext,
  ) => JsonType extends { [K in keyof JsonType]: any }
    ? FromJsonMapping<ObjectType, JsonType> extends { objectField: infer OF }
      ? OF extends keyof ObjectType
        ? ObjectType[OF] | undefined
        : never
      : never
    : never;
};

type ToJsonMapping<ObjectType, JsonType> = {
  field?: never;
  objectField?: never;
  jsonField: keyof JsonType;
  toJson: (
    obj: ObjectType,
    savingContext: SavingContext,
  ) => ObjectType extends { [K in keyof ObjectType]: any }
    ? ToJsonMapping<ObjectType, JsonType> extends { jsonField: infer JF }
      ? JF extends keyof JsonType
        ? JsonType[JF]
        : never
      : never
    : never;
  fromJson?: never;
};

export type JsonFieldMapping<ObjectType, JsonType> = (
  | SimpleFieldMapping<ObjectType, JsonType>
  | FromJsonMapping<ObjectType, JsonType>
  | ToJsonMapping<ObjectType, JsonType>
) & {
  versionFrom?: string;
  versionTo?: string;
  flags?: {
    internalField?: boolean;
    unusedField?: boolean;
  };
  toCondition?: (obj: ObjectType, savingContext: SavingContext) => boolean;
  fromCondition?: (obj: JsonType, loadingContext: LoadingContext) => boolean;
};

export function transformObjectToJson<
  ObjectType extends object,
  JsonType extends object,
>(
  object: ObjectType,
  mappings: JsonFieldMapping<ObjectType, JsonType>[],
  savingContext: SavingContext,
): JsonType {
  const result: any = {};
  for (const fieldMapping of mappings) {
    if (
      (!fieldMapping.versionFrom ||
        semver.gte(
          savingContext.version.numbering,
          fieldMapping.versionFrom,
        )) &&
      (!fieldMapping.versionTo ||
        semver.lte(savingContext.version.numbering, fieldMapping.versionTo)) &&
      (!fieldMapping.toCondition ||
        fieldMapping.toCondition(object, savingContext)) &&
      (!fieldMapping.flags?.internalField || savingContext.internalFields) &&
      (!fieldMapping.flags?.unusedField || !savingContext.excludeUnused)
    ) {
      if (fieldMapping.field) {
        result[fieldMapping.field] = object[fieldMapping.field];
      } else if (fieldMapping.toJson) {
        result[fieldMapping.jsonField] = fieldMapping.toJson(
          object,
          savingContext,
        );
      }
    }
  }
  return result;
}

export function transformJsonToObject<
  ObjectType extends object,
  JsonType extends object,
>(
  json: JsonType,
  mappings: JsonFieldMapping<ObjectType, JsonType>[],
  loadingContext: JsonLoadingContext,
): ObjectType {
  const result = {} as ObjectType;
  for (const fieldMapping of mappings) {
    if (
      (!fieldMapping.versionFrom ||
        semver.gte(
          loadingContext.version.numbering,
          fieldMapping.versionFrom,
        )) &&
      (!fieldMapping.versionTo ||
        semver.lte(loadingContext.version.numbering, fieldMapping.versionTo)) &&
      (!fieldMapping.fromCondition ||
        fieldMapping.fromCondition(json, loadingContext))
    ) {
      if (fieldMapping.field) {
        if (json[fieldMapping.field] !== undefined) {
          result[fieldMapping.field] = (json as any)[fieldMapping.field];
        }
      } else if (fieldMapping.fromJson) {
        const resultValue = fieldMapping.fromJson(json, result, loadingContext);
        if (resultValue !== undefined) {
          result[fieldMapping.objectField] = resultValue;
        }
      }
    }
  }
  return result;
}

export function applyJsonFieldsToObject<
  ObjectType extends object,
  JsonType extends object,
>(
  json: JsonType,
  object: ObjectType,
  mappings: JsonFieldMapping<ObjectType, JsonType>[],
  loadingContext: JsonLoadingContext,
): ObjectType {
  for (const fieldMapping of mappings) {
    if (
      (!fieldMapping.versionFrom ||
        semver.gte(
          loadingContext.version.numbering,
          fieldMapping.versionFrom,
        )) &&
      (!fieldMapping.versionTo ||
        semver.lte(loadingContext.version.numbering, fieldMapping.versionTo)) &&
      (!fieldMapping.fromCondition ||
        fieldMapping.fromCondition(json, loadingContext))
    ) {
      if (fieldMapping.field) {
        if (json[fieldMapping.field] !== undefined) {
          object[fieldMapping.field] = (json as any)[fieldMapping.field];
        }
      } else if (fieldMapping.fromJson) {
        const resultValue = fieldMapping.fromJson(json, object, loadingContext);
        if (resultValue !== undefined) {
          object[fieldMapping.objectField] = resultValue;
        }
      }
    }
  }
  return object;
}

export function writeDataEntryToJsonFile<
  ObjectType extends { referenceId: string },
  JsonType extends object,
>(
  directoryPath: string,
  object: ObjectType,
  mappings: JsonFieldMapping<ObjectType, JsonType>[],
  savingContext: SavingContext,
) {
  const transformedData = transformObjectToJson(
    object,
    mappings,
    savingContext,
  );
  writeFileSync(
    path.join(directoryPath, `${object.referenceId}.json`),
    createJson(transformedData),
  );
}

export function writeDataEntriesToJson<
  ObjectType extends {
    referenceId: string;
    writeToJsonFile: (directory: string, savingContext: SavingContext) => void;
  },
>(
  baseDirectory: string,
  dataDirectory: string,
  objects: Nullable<ObjectType>[],
  savingContext: SavingContext,
) {
  const directoryPath = path.join(baseDirectory, dataDirectory);
  clearDirectory(directoryPath);

  objects.forEach((object) => {
    if (object) {
      object.writeToJsonFile(directoryPath, savingContext);
    }
  });

  writeJsonFileIndex(directoryPath, objects);
}
