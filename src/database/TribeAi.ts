import semver from "semver";
import BufferReader from "../BufferReader";
import { TextFileNames } from "../textfile/TextFile";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { LoadingContext } from "./LoadingContext";
import { ObjectClass } from "./object/ObjectClass";
import { SavingContext } from "./SavingContext";
import { asBool16, asBool8, asFloat32, asInt16, asUInt16, asUInt32, asUInt8, Bool16, Bool8, Float32, Int16, Int32, NullPointer, Pointer, UInt16, UInt32, UInt8 } from "../ts/base-types";
import { AgeId, Percentage, PrototypeId, TechnologyType } from "./Types";
import path from "path";
import { OldJsonFieldConfig, oldWriteDataEntriesToJson } from "../json/json-serialization";
import { Nullable } from "../ts/ts-utils";
import { createReferenceIdFromString, createReferenceString } from "../json/reference-id";
import { BaseObjectPrototype } from "./object/ObjectPrototypes";
import { getDataEntry } from "../util";

// Many entries have exactly 8 entries in an array... Perhaps these correspond to 1 for each age in very early stages of development when there were 8 ages
// For exampla the object state type as 8 entries for target units and target percents, perhaps to allow specifying how many of that unit the AI should
// have when at a specific age

interface AiGroup {
    targetPercents: Percentage<Int16>[];
    assetsTotal: Int32;
    deltaPercent: Percentage<Int16>;
    padding16: UInt16;
}

interface AiObjectGoal {
    targetCounts: Int16[];
    targetPercents: Percentage<Int16>[];
    prototypeId: PrototypeId<Int16>;
    prototype: BaseObjectPrototype | null;
    objectClass: ObjectClass;
    aiGroupId: Int16;
    objectCount: Int16;
    assetsTotal: Int32;
    deltaPercent: Percentage<Int16>;
    stateName: string;
    padding43: UInt8;
}

interface AiTechnologyGoal {
    targetPercents: Percentage<Int16>[];
    technologyType: TechnologyType; // this references the "unused" value in techonlogies
    padding12: UInt16;
    assetsTotal: Int32;
    deltaPercent: Percentage<Int16>;
    stateName: string;
    padding2F: UInt8;
}

const jsonFields: OldJsonFieldConfig<TribeAi>[] = [
    { field: "objectGoals", toJson: (obj) => obj.objectGoals.map(objectGoal => ({
        prototypeId: createReferenceString("ObjectPrototype", objectGoal.prototype?.referenceId, objectGoal.prototypeId),
        objectClass: objectGoal.objectClass,
        objectName: objectGoal.stateName,
        aiGroupId: objectGoal.aiGroupId,
        targetValues: objectGoal.targetCounts.map((targetCount, index) => ({
            count: objectGoal.targetCounts[index],
            percent: objectGoal.targetPercents[index]
        }))
    }))},
    { field: "technologyGoals", toJson: (obj) => obj.technologyGoals.map(technologyGoal => ({
        technologyType: technologyGoal.technologyType,
        targetPercents: technologyGoal.targetPercents,
    }))},
    { field: "aiGroups", toJson: (obj) => obj.aiGroups.map(aiGroup => ({
        targetPercents: aiGroup.targetPercents
    }))},
    { field: "field9C"},
    { field: "fieldA3"}
];

export class TribeAi {
    referenceId: string = "";
    id: Int16 = asInt16(-1);
    padding02: UInt16 = asUInt16(0);
    objectGoalsPointer: Pointer = NullPointer;
    objectGoals: AiObjectGoal[] = [];
    objectPrototypeCount: Int16 = asInt16(0);
    padding0A: UInt16 = asUInt16(0);
    objectIdToGoalMapPointer: Pointer = NullPointer;
    objectTotalCostsPointer: Pointer = NullPointer;
    padding16: UInt16 = asUInt16(0);
    technologyGoalsPointer: Pointer = NullPointer;
    technologyGoals: AiTechnologyGoal[] = [];
    technologyIdToGoalMapPointer: Pointer = NullPointer;
    technologyTotalCostsPointer: Pointer = NullPointer;
    aiGroups: AiGroup[] = [];
    field9C: UInt8[] = [];
    fieldA3: UInt8[] = [];
    paddingA9: UInt8 = asUInt8(0);
    paddingAA: UInt16 = asUInt16(0);
    ordersPointer: Pointer = NullPointer;
    playerPointer: Pointer = NullPointer;
    logFilePointer: Pointer = NullPointer;
    currentAge: AgeId<Int16> = asInt16(0);
    paddingBA: UInt16 = asUInt16(0);
    townCenterPointer: Pointer = NullPointer;
    fieldC0: UInt8 = asUInt8(0);
    paddingC1: UInt8 = asUInt8(0);
    paddingC2: UInt16 = asUInt16(0);
    fieldC4: UInt32 = asUInt32(0);
    worldTime: Float32 = asFloat32(0);
    fieldCC: UInt8 = asUInt8(0);
    quickThink: Bool8 = asBool8(false);
    fieldCE: UInt16 = asUInt16(0);
    fieldD0: UInt32 = asUInt32(0);
    loggingEnabled: Bool16 = asBool16(false);
    paddingD6: UInt16 = asUInt16(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
            return;
        }
        this.id = id;
        this.referenceId = createReferenceIdFromString(`Ai ${this.id + 1}`);

        const objectStatesCount = buffer.readInt16();
        this.padding02 = buffer.readUInt16();
        this.objectGoalsPointer = buffer.readPointer();
        this.objectPrototypeCount = buffer.readInt16();
        this.padding0A = buffer.readUInt16();
        this.objectIdToGoalMapPointer = buffer.readPointer();
        this.objectTotalCostsPointer = buffer.readPointer();
        const technologyStatesCount = buffer.readInt16();
        this.padding16 = buffer.readUInt16();
        this.technologyGoalsPointer = buffer.readPointer();
        this.technologyIdToGoalMapPointer = buffer.readPointer();
        this.technologyTotalCostsPointer = buffer.readPointer();

        this.aiGroups = [];
        for (let i = 0; i < 5; ++i) {
            const targetPercents: Percentage<Int16>[] = [];
            for (let i = 0; i < 8; ++i) {
                targetPercents.push(buffer.readInt16());
            }
            this.aiGroups.push({
                targetPercents,
                assetsTotal: buffer.readInt32(),
                deltaPercent: buffer.readInt16(),
                padding16: buffer.readUInt16()
            });
        }

        this.field9C = [];
        for (let i = 0; i < 7; ++i) {
            this.field9C.push(buffer.readUInt8());
        }
        this.fieldA3 = [];
        for (let i = 0; i < 6; ++i) {
            this.fieldA3.push(buffer.readUInt8());
        }
        this.paddingA9 = buffer.readUInt8();
        this.paddingAA = buffer.readUInt16();
        this.ordersPointer = buffer.readPointer();
        this.playerPointer = buffer.readPointer();
        this.logFilePointer = buffer.readPointer();
        this.currentAge = buffer.readInt16();
        this.paddingBA = buffer.readUInt16();
        this.townCenterPointer = buffer.readPointer();
        this.fieldC0 = buffer.readUInt8();
        this.paddingC1 = buffer.readUInt8();
        this.paddingC2 = buffer.readUInt16();
        this.fieldC4 = buffer.readUInt32();
        this.worldTime = buffer.readFloat32();
        this.fieldCC = buffer.readUInt8();
        this.quickThink = buffer.readBool8();
        this.fieldCE = buffer.readUInt16();
        this.fieldD0 = buffer.readUInt32();
        this.loggingEnabled = buffer.readBool16();
        this.paddingD6 = buffer.readUInt16();

        this.objectGoals = [];
        for (let i = 0; i < objectStatesCount; ++i) {
            const targetCounts: Int16[] = [];
            const targetPercents: Percentage<Int16>[] = [];
            for (let i = 0; i < 8; ++i) {
                targetCounts.push(buffer.readInt16());
            }
            for (let i = 0; i < 8; ++i) {
                targetPercents.push(buffer.readInt16());
            }
            this.objectGoals.push({
                targetCounts,
                targetPercents,
                prototypeId: buffer.readInt16(),
                prototype: null,
                objectClass: buffer.readInt16(),
                aiGroupId: buffer.readInt16(),
                objectCount: buffer.readInt16(),
                assetsTotal: buffer.readInt32(),
                deltaPercent: buffer.readInt16(),
                stateName: buffer.readFixedSizeString(21),
                padding43: buffer.readUInt8()
            });
        }

        this.technologyGoals = [];
        for (let i = 0; i < technologyStatesCount; ++i) {
            const targetPercents: Percentage<Int16>[] = [];
            for (let i = 0; i < 8; ++i) {
                targetPercents.push(buffer.readInt16());
            }
            this.technologyGoals.push({
                targetPercents,
                technologyType: buffer.readInt16(),
                padding12: buffer.readUInt16(),
                assetsTotal: buffer.readInt32(),
                deltaPercent: buffer.readInt16(),
                stateName: buffer.readFixedSizeString(21),
                padding2F: buffer.readUInt8()
            });
        }

    }
    
    linkOtherData(objects: Nullable<BaseObjectPrototype>[], loadingContext: LoadingContext) {
        this.objectGoals.forEach(objectState => {
            objectState.prototype = getDataEntry(objects, objectState.prototypeId, "ObjectPrototype", this.referenceId, loadingContext);
        });
    }
}


export function readTribeAiFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): (TribeAi | null)[] {
    const result: (TribeAi | null)[] = [];
    if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
        const aiEntryCount = buffer.readInt16();
        const validAis: boolean[] = [];
        for (let i = 0; i < aiEntryCount; ++i) {
            validAis.push(buffer.readBool32());
        }
        for (let i = 0; i < aiEntryCount; ++i) {
            if (validAis[i]) {
                const tribeAi = new TribeAi();
                tribeAi.readFromBuffer(buffer, asInt16(i), loadingContext);
                result.push(tribeAi);
            }
        }
    }
    return result;
}

export function writeTribeAiToWorldTextFile(outputDirectory: string, aiEntries: (TribeAi | null)[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.TribeAi));
    textFileWriter.raw(aiEntries.length).eol();

    aiEntries.forEach(aiEntry => {
        if (aiEntry) {
            textFileWriter.integer(aiEntry.id).eol();
            
            textFileWriter
                .indent(4)
                .raw(aiEntry.objectGoals.length).eol()

            aiEntry.objectGoals.forEach(objectGoal => {
                textFileWriter
                    .indent(6)
                    .integer(objectGoal.prototypeId)
                    .integer(objectGoal.objectClass)
                    .integer(objectGoal.aiGroupId)
                    .string(objectGoal.stateName, 21);

                for (let i = 0; i < 8; ++i) {
                    textFileWriter
                        .integer(objectGoal.targetCounts[i])
                        .integer(objectGoal.targetPercents[i])
                }
                textFileWriter.eol();
            })

            textFileWriter.indent(2);
            for (let i = 0; i < 7; ++i) {
                textFileWriter.integer(aiEntry.field9C[i]);
            }
            for (let i = 0; i < 6; ++i) {
                textFileWriter.integer(aiEntry.fieldA3[i]);
            }
            textFileWriter.eol();
            
            textFileWriter
                .indent(4)
                .raw(aiEntry.technologyGoals.length).eol()

            aiEntry.technologyGoals.forEach(techGoal => {
                textFileWriter
                    .indent(6)
                    .integer(techGoal.technologyType)
                    .string(techGoal.stateName, 21);
                    
                for (let i = 0; i < 8; ++i) {
                    textFileWriter
                        .integer(techGoal.targetPercents[i])
                }
                textFileWriter.eol();
            })

            for (let i = 0; i < 5; ++i) {
                textFileWriter.indent(2)
                for (let j = 0; j < 8; ++j) {
                    textFileWriter.integer(aiEntry.aiGroups[i].targetPercents[j])
                }
                textFileWriter.eol();
            }

        }
    })

    textFileWriter.close();
}

export function writeTribeAiToJsonFiles(outputDirectory: string, aiEntries: Nullable<TribeAi>[], savingContext: SavingContext) {
    if (semver.lt(savingContext.version.numbering, "2.0.0")) {
        oldWriteDataEntriesToJson(outputDirectory, "tribeai", aiEntries, jsonFields, savingContext); 
    }
}
