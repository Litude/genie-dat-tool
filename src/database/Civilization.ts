import semver from "semver";
import BufferReader from "../BufferReader";
import { TextFileNames, textFileStringCompare } from "../textfile/TextFile";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { Attribute, createDefaultAttribute } from "./Attributes";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { ArchitectureStyleId, StateEffectId } from "./Types";
import { asInt16, asUInt8, Float32, Int16, UInt8 } from "../ts/base-types";
import path from "path";
import { OldJsonFieldConfig, oldWriteDataEntriesToJson } from "../json/json-serialization";
import { StateEffect } from "./research/StateEffect";
import { createReferenceString, createReferenceIdFromString as createReferenceIdFromString } from "../json/reference-id";
import { Nullable } from "../ts/ts-utils";
import { getDataEntry } from "../util";

const jsonFields: OldJsonFieldConfig<Civilization>[] = [
    { field: "civilizationType" },
    { field: "internalName"},
    { field: "bonusEffectId", versionFrom: "1.4.0", toJson: (obj) => createReferenceString("StateEffect", obj.bonusEffect?.referenceId, obj.bonusEffectId) },
    { field: "attributes", toJson: (obj) => ({
        totalCount: obj.attributes.length,
        entries: obj.attributes.reduce((acc, cur, index) => {
        if (cur) {
            acc[index] = cur;
        }
        return acc;
    }, {} as Record<number, number>)})},
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
    architectureStyle: ArchitectureStyleId<UInt8> = asUInt8(0);

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
        this.architectureStyle = buffer.readUInt8();
    }
        
    linkOtherData(stateEffects: Nullable<StateEffect>[], loadingContext: LoadingContext) {
        this.bonusEffect = getDataEntry(stateEffects, this.bonusEffectId, "StateEffect", this.referenceId, loadingContext);
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
    oldWriteDataEntriesToJson(outputDirectory, "civilizations", civilizations, jsonFields, savingContext);
}
