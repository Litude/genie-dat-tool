import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../BufferReader";
import { TextFileNames, textFileStringCompare } from "../textfile/TextFile";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { Attribute, createDefaultAttribute } from "./Attributes";
import { JsonLoadingContext, LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { ArchitectureStyleId, ArchitectureStyleIdSchema, ReferenceStringSchema, StateEffectId } from "./Types";
import { asFloat32, asInt16, asUInt8, Float32, Float32Schema, Int16, UInt8, UInt8Schema } from "../ts/base-types";
import path from "path";
import { applyJsonFieldsToObject, createJson, JsonFieldMapping, OldJsonFieldConfig, oldWriteDataEntriesToJson, readJsonFileIndex, transformObjectToJson, writeDataEntriesToJson } from "../json/json-serialization";
import { StateEffect } from "./research/StateEffect";
import { createReferenceString, createReferenceIdFromString as createReferenceIdFromString, getIdFromReferenceString } from "../json/reference-id";
import { Nullable } from "../ts/ts-utils";
import { getDataEntry } from "../util";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";

const CivilizationSchema = z.object({
    civilizationType: UInt8Schema,
    internalName: z.string(),
    bonusEffectId: ReferenceStringSchema.optional(),
    attributes: z.object({
        totalCount: z.number().int(),
        entries: z.record(z.string().regex(/^\d+$/), Float32Schema),
    }),
    architectureStyle: ArchitectureStyleIdSchema,
});

type CivilizationJson = z.infer<typeof CivilizationSchema>;

const CivilizationJsonMapping: JsonFieldMapping<Civilization, CivilizationJson>[] = [
    { field: "civilizationType" },
    { field: "internalName"},
    { jsonField: "bonusEffectId", versionFrom: "1.4.0", toJson: (obj) => createReferenceString("StateEffect", obj.bonusEffect?.referenceId, obj.bonusEffectId) },
    { objectField: "bonusEffectId", versionFrom: "1.4.0", fromJson: (json, obj, loadingContext) => json.bonusEffectId !== undefined ? getIdFromReferenceString<Int16>("StateEffect", obj.referenceId, json.bonusEffectId, loadingContext.dataIds.stateEffectIds) : asInt16(-1) },
    { jsonField: "attributes", toJson: (obj) => ({
        totalCount: obj.attributes.length,
        entries: obj.attributes.reduce((acc, cur, index) => {
        if (cur) {
            acc[index] = cur;
        }
        return acc;
    }, {} as Record<number, Float32>)})},
    { objectField: "attributes", fromJson: (json, obj, loadingContext) => {
        const result: Float32[] = Array(json.attributes.totalCount).fill(asFloat32(0));
        Object.entries(json.attributes.entries).forEach(([resourceIdString, resourceAmount]) => {
            const resourceId = +resourceIdString;
            if (resourceId >= json.attributes.totalCount) {
                throw new Error(`Civilization ${obj.referenceId} has ${json.attributes.totalCount} attributes, but attempted to set attribute ${resourceId}`);
            }
            else {
                result[resourceId] = resourceAmount;
            }
        })
        return result;
    }},
    { field: "architectureStyle" }
];

export class Civilization {
    referenceId: string = "";
    id: Int16 = asInt16(-1);
    civilizationType: UInt8 = asUInt8(1); // should always be 1 for a valid civilization
    internalName: string = "";
    bonusEffectId: StateEffectId<Int16> = asInt16(-1);
    bonusEffect: StateEffect | null = null;
    attributes: Float32[] = [];
    architectureStyle: ArchitectureStyleId = asUInt8<ArchitectureStyleId>(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        this.id = id;
        this.civilizationType = buffer.readUInt8();
        this.internalName = buffer.readFixedSizeString(20);
        this.referenceId = createReferenceIdFromString(this.internalName);
        const attributeCount = buffer.readInt16();
        if (semver.gte(loadingContext.version.numbering, "1.4.0")) {
            this.bonusEffectId = buffer.readInt16();
        }

        this.attributes = [];
        for (let i = 0; i < attributeCount; ++i) {
            this.attributes.push(buffer.readFloat32());
        }
        this.architectureStyle = buffer.readUInt8<ArchitectureStyleId>();
    }
    
    readFromJsonFile(jsonFile: CivilizationJson, id: Int16, referenceId: string, loadingContext: JsonLoadingContext) {
        this.id = id;
        this.referenceId = referenceId;
        applyJsonFieldsToObject(jsonFile, this, CivilizationJsonMapping, loadingContext)
    }
    
    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeFileSync(path.join(directory, `${this.referenceId}.json`), createJson(this.toJson(savingContext)));
    }
        
    linkOtherData(stateEffects: Nullable<StateEffect>[], loadingContext: LoadingContext) {
        this.bonusEffect = getDataEntry(stateEffects, this.bonusEffectId, "StateEffect", this.referenceId, loadingContext);
    }
    
    toJson(savingContext: SavingContext) {
        return transformObjectToJson(this, CivilizationJsonMapping, savingContext);
    }
}

export function writeCivilizationsToWorldTextFile(outputDirectory: string, civilizations: Civilization[], attributes: Attribute[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Civilizations));

    textFileWriter.raw(civilizations.length).eol(); // Total civilization entries
    textFileWriter.raw(civilizations.length).eol(); // Entries that have data here (these should always match because there are no null civilization entries)

    const sortedCivilizations = [...civilizations].sort((a, b) => textFileStringCompare(a.internalName, b.internalName));
    sortedCivilizations.forEach(civilization => {

        textFileWriter
            .integer(civilization.id)
            .integer(civilization.civilizationType)
            .string(civilization.internalName, 17)
            .conditional(semver.gte(savingContext.version.numbering, "1.4.0"), writer => writer.integer(civilization.bonusEffectId))
            .integer(civilization.attributes.length)
            .integer(civilization.attributes.filter(x => x).length)
            .eol();

        const civAttributes = civilization.attributes.map((attributeAmount, id) => {
            const attribute = attributes[id] ? attributes[id] : createDefaultAttribute(id);
            return {
                ...attribute,
                amount: attributeAmount
            }
        }).sort((a, b) => textFileStringCompare(a.internalName, b.internalName))
        .filter(entry => entry.amount)

        civAttributes.forEach(attribute => {
            textFileWriter
                .indent(2)
                .integer(attribute.id)
                .float(attribute.amount)
                .eol();
        })

        textFileWriter
            .indent(2)
            .integer(civilization.architectureStyle)
            .eol();
    })
    textFileWriter.close();

}

export function writeCivilizationsToJsonFiles(outputDirectory: string, civilizations: Nullable<Civilization>[], savingContext: SavingContext) {
    writeDataEntriesToJson(outputDirectory, "civilizations", civilizations, savingContext);
}

export function readCivilizationsFromJsonFiles(inputDirectory: string, civilizationIds: (string | null)[], loadingContext: JsonLoadingContext) {
    const civilizationsDirectory = path.join(inputDirectory, 'civilizations');
    const civilizations: Civilization[] = [];
    civilizationIds.forEach((civilizationReferenceId, civilizationNumberId) => {
        if (civilizationReferenceId === null) {
            // TODO: Make a null civilization fall back to None (RoR trial style)
            throw new Error("Null civilizations are not supported!")
        }
        else {
            const civilizationJson = CivilizationSchema.parse(JSON5.parse(readFileSync(path.join(civilizationsDirectory, `${civilizationReferenceId}.json`)).toString('utf8')));
            const civilization = new Civilization();
            civilization.readFromJsonFile(civilizationJson, asInt16(civilizationNumberId), civilizationReferenceId, loadingContext);
            civilizations.push(civilization);
        }

    })
    return civilizations;
}

export function readCivilizationIdsFromJsonIndex(inputDirectory: string) {
    return readJsonFileIndex(path.join(inputDirectory, "civilizations"));
}
