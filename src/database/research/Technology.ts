import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asInt16, asInt32, asUInt8, Bool8, Int16, Int32, UInt8 } from "../../ts/base-types";
import { AttributeId, PrototypeId, StateEffectId, StringId, TechnologyId, TechnologyType } from "../Types";
import path from 'path';
import { createReferenceString, createReferenceIdFromString } from '../../json/reference-id';
import { SceneryObjectPrototype } from '../object/SceneryObjectPrototype';
import { StateEffect } from './StateEffect';
import { getDataEntry } from '../../util';
import { isDefined, Nullable, trimEnd } from '../../ts/ts-utils';
import { OldJsonFieldConfig, oldWriteDataEntriesToJson, readJsonFileIndex } from '../../json/json-serialization';

interface TechnologyResourceCost {
    attributeId: AttributeId<Int16>;
    amount: Int16;
    costDeducted: Bool8;
}

const jsonFields: OldJsonFieldConfig<Technology>[] = [
    { field: "internalName" },
    { field: "prerequisiteTechnologyIds",
        toJson: (obj) => {
            return obj.prerequisiteTechnologies
                .slice(0, trimEnd(obj.prerequisiteTechnologyIds, entry => entry === -1).length)
                .map((entry, index) => createReferenceString("Technology", entry?.referenceId, obj.prerequisiteTechnologyIds[index])) }},
    { field: 'resourceCosts', toJson: (obj) => trimEnd(obj.resourceCosts, entry => entry.attributeId === -1) },
    { field: 'minimumPrerequisites' },
    { field: 'researchLocationId', toJson: (obj) => createReferenceString("ObjectPrototype", obj.researchLocation?.referenceId, obj.researchLocationId) },
    { field: 'nameStringId', versionFrom: "1.5.0" },
    { field: 'researchStringId', versionFrom: "1.5.0" },
    { field: 'researchDuration' },
    { field: 'stateEffectId', toJson: (obj) => createReferenceString("StateEffect", obj.stateEffect?.referenceId, obj.stateEffectId) },
    { field: 'technologyType' },
    { field: 'iconNumber' },
    { field: 'researchButtonIndex' },
    { field: 'helpDialogStringId', versionFrom: "2.7.0" },
    { field: 'helpPageStringId', versionFrom: "2.7.0" },
    { field: 'hotkeyStringId', versionFrom: "2.7.0" }
];

export class Technology {
    referenceId: string = "";
    id: Int16 = asInt16(-1);
    internalName: string = "";
    prerequisiteTechnologyIds: TechnologyId<Int16>[] = [];
    prerequisiteTechnologies: (Technology | null)[] = [];
    resourceCosts: TechnologyResourceCost[] = [];
    minimumPrerequisites: Int16 = asInt16(0);
    researchLocationId: PrototypeId<Int16> = asInt16<PrototypeId<Int16>>(-1);
    researchLocation: SceneryObjectPrototype | null = null;
    nameStringId: StringId<Int16> = asInt16<StringId<Int16>>(-1);
    researchStringId: StringId<Int16> = asInt16<StringId<Int16>>(-1);
    researchDuration: Int16 = asInt16(0);
    stateEffectId: StateEffectId<Int16> = asInt16(-1);
    stateEffect: StateEffect | null = null;
    technologyType: TechnologyType = asInt16<TechnologyType>(0); // used by old AI for tracking similar technologies
    iconNumber: Int16 = asInt16(0);
    researchButtonIndex: UInt8 = asUInt8(0);
    helpDialogStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1); // The game actually only supports 16-bit string indexes, higher values will overflow
    helpPageStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
    hotkeyStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        this.id = id;
        this.prerequisiteTechnologyIds = [];
        for (let i = 0; i < 4; ++i) {
            this.prerequisiteTechnologyIds.push(buffer.readInt16());
        }
        this.resourceCosts = [];
        for (let i = 0; i < 3; ++i) {
            this.resourceCosts.push({
                attributeId: buffer.readInt16(),
                amount: buffer.readInt16(),
                costDeducted: buffer.readBool8()
            });
        }
        this.minimumPrerequisites = buffer.readInt16();
        this.researchLocationId = buffer.readInt16<PrototypeId<Int16>>();
        if (semver.gte(loadingContext.version.numbering, "1.5.0")) {
            this.nameStringId = buffer.readInt16<StringId<Int16>>();
            this.researchStringId = buffer.readInt16<StringId<Int16>>();
        }
        else {
            this.nameStringId = asInt16<StringId<Int16>>(-1);
            this.researchStringId = asInt16<StringId<Int16>>(-1);
        }
        this.researchDuration = buffer.readInt16();
        this.stateEffectId = buffer.readInt16();
        this.technologyType = buffer.readInt16<TechnologyType>();
        this.iconNumber = buffer.readInt16();
        this.researchButtonIndex = buffer.readUInt8();
        if (semver.gte(loadingContext.version.numbering, "2.7.0")) {
            this.helpDialogStringId = buffer.readInt32<StringId<Int32>>();
            this.helpPageStringId = buffer.readInt32<StringId<Int32>>();
            this.hotkeyStringId = buffer.readInt32<StringId<Int32>>();
        }
        this.internalName = buffer.readPascalString16();
        this.referenceId = createReferenceIdFromString(this.internalName);
    }

    isValid() {
        return this.internalName !== "";
    }
    
    linkOtherData(technologies: Nullable<Technology>[], objects: Nullable<SceneryObjectPrototype>[], stateEffects: Nullable<StateEffect>[], loadingContext: LoadingContext) {
        this.prerequisiteTechnologies = this.prerequisiteTechnologyIds.map(technologyId => getDataEntry(technologies, technologyId, "Technology", this.referenceId, loadingContext));
        this.researchLocation = getDataEntry(objects, this.researchLocationId, "ObjectPrototype", this.referenceId, loadingContext);
        this.stateEffect = getDataEntry(stateEffects, this.stateEffectId, "StateEffect", this.referenceId, loadingContext);
    }

    toString() {
        return this.internalName;
    }
}

export function readTechnologiesFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): Nullable<Technology>[] {
    const result: Nullable<Technology>[] = [];
    const technologyCount = buffer.readInt16();
    for (let i = 0; i < technologyCount; ++i) {
        const technology = new Technology();
        technology.readFromBuffer(buffer, asInt16(i), loadingContext);
        result.push(technology.isValid() ? technology : null);
    }

    return result;
}

export function writeTechnologiesToWorldTextFile(outputDirectory: string, technologies: Nullable<Technology>[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Technologies));
    textFileWriter.raw(technologies.length).eol(); // Total technology entries
    const validEntries = technologies.filter(isDefined);
    textFileWriter.raw(validEntries.length).eol(); // Entries that have data

    validEntries.forEach(entry => {
        textFileWriter
            .integer(entry.id)
            .string(entry.internalName.replaceAll(' ', '_'), 31)
            .integer(entry.minimumPrerequisites)
            .integer(entry.researchDuration)
            .integer(entry.stateEffectId)
            .integer(entry.technologyType)
            .integer(entry.iconNumber)
            .integer(entry.researchButtonIndex)
            .integer(entry.researchLocationId)

        for (let i = 0; i < 4; ++i) {
            textFileWriter.integer(entry.prerequisiteTechnologyIds[i]);
        }
        for (let i = 0; i < 3; ++i) {
            const cost = entry.resourceCosts[i];
            textFileWriter
                .integer(cost.attributeId)
                .integer(cost.amount)
                .integer(cost.costDeducted ? 1 : 0);
        }

        if (semver.gte(savingContext.version.numbering, "1.5.0")) {
            textFileWriter
                .integer(entry.nameStringId)
                .integer(entry.researchStringId);
        }

        if (semver.gte(savingContext.version.numbering, "2.7.0")) {
            textFileWriter
                .integer(entry.helpDialogStringId)
                .integer(entry.helpPageStringId)
                .integer(entry.hotkeyStringId);
        }

        textFileWriter
            .eol();
    });
    textFileWriter.close();

}

export function writeTechnologiesToJsonFiles(outputDirectory: string, technologies: Nullable<Technology>[], savingContext: SavingContext) {
    oldWriteDataEntriesToJson(outputDirectory, "techs", technologies, jsonFields, savingContext);
}

export function readTechnologyIdsFromJsonIndex(inputDirectory: string) {
    return readJsonFileIndex(path.join(inputDirectory, "techs"));
}
