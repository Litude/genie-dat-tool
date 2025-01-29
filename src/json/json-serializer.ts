import semver from "semver";
import { LoadingContext } from "../database/LoadingContext";
import { SavingContext } from "../database/SavingContext";
import { Nullable } from "../ts/ts-utils";
import path from "path";
import { clearDirectory } from "../files/file-utils";
import { createJson } from "./filenames";
import { writeFileSync } from "fs";

export type JsonFieldConfig<T> = {
    key: keyof T,
    versionFrom?: string;
    flags?: {
        internalField?: boolean,
        unusedField?: boolean;
    },
    condition?: (obj: T, savingContext: SavingContext) => boolean,
    transformTo?: (obj: T, savingContext: SavingContext) => any,
    transformFrom?: (obj: T, loadingContext: LoadingContext) => any
}

export function transformObjectToJson<T extends object>(object: T, config: JsonFieldConfig<T>[], savingContext: SavingContext) {
    const result: any = {};
    for (const field of config) {
        if (
            (!field.versionFrom || semver.gte(savingContext.version.numbering, field.versionFrom)) &&
            (!field.condition || field.condition(object, savingContext)) &&
            (!field.flags?.internalField || savingContext.internalFields) &&
            (!field.flags?.unusedField || !savingContext.excludeUnused)
        ) {
            result[field.key] = field.transformTo ? field.transformTo(object, savingContext) : (object as any)[field.key]
        }
    }
    return result;
}

export function writeDataEntryToJsonFile<T extends { referenceId: string }>(directoryPath: string, object: T, config: JsonFieldConfig<T>[], savingContext: SavingContext) {
    const transformedData = transformObjectToJson(object, config, savingContext);
    writeFileSync(path.join(directoryPath, `${object.referenceId}.json`), createJson(transformedData));
}

function writeJsonFileIndex(outputDirectory: string, entries: ({ referenceId: string} | null)[]) {
    const referenceIds = entries.map(entry => entry?.referenceId ?? null);
    writeFileSync(path.join(outputDirectory, "index.json"), createJson(referenceIds));
}

export function writeDataEntriesToJson<T extends { referenceId: string }>(baseDirectory: string, dataDirectory: string, objects: Nullable<T>[], config: JsonFieldConfig<T>[], savingContext: SavingContext) {
    const directoryPath = path.join(baseDirectory, dataDirectory);
    clearDirectory(directoryPath);

    objects.forEach(object => {
        if (object) {
            writeDataEntryToJsonFile(directoryPath, object, config, savingContext);
        }
    });
    
    writeJsonFileIndex(directoryPath, objects);
}
