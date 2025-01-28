import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asInt16, asInt32, asUInt8, AttributeId, Bool8, Int16, Int32, PrototypeId, StateEffectId, StringId, TechnologyId, UInt8 } from "../Types";
import path from 'path';
import { clearDirectory } from '../../files/file-utils';
import { createJson, createReferenceString, createSafeFilenameStem, writeJsonFileIndex } from '../../json/filenames';
import { writeFileSync } from 'fs';
import { SceneryObjectPrototype } from '../object/SceneryObjectPrototype';
import { StateEffect } from './StateEffect';
import { getDataEntry } from '../../util';
import { isDefined, Nullable, pick, trimEnd } from '../../ts/ts-utils';

interface TechnologyResourceCost {
    attributeId: AttributeId<Int16>;
    amount: Int16;
    costDeducted: Bool8;
}

const jsonFields: (keyof Technology)[] = [
    "internalName",
    "minimumPrerequisites",
    "nameStringId",
    "researchStringId",
    "researchDuration",
    "technologyType",
    "iconNumber",
    "researchButtonIndex",
    "helpDialogStringId",
    "helpPageStringId",
    "hotkeyStringId"
]

export class Technology {
    referenceId: string = "";
    id: Int16 = asInt16(-1);
    internalName: string = "";
    prerequisiteTechnologyIds: TechnologyId<Int16>[] = [];
    prerequisiteTechnologies: (Technology | null)[] = [];
    resourceCosts: TechnologyResourceCost[] = [];
    minimumPrerequisites: Int16 = asInt16(0);
    researchLocationId: PrototypeId<Int16> = asInt16(-1);
    researchLocation: SceneryObjectPrototype | null = null;
    nameStringId: StringId<Int16> = asInt16(-1);
    researchStringId: StringId<Int16> = asInt16(-1);
    researchDuration: Int16 = asInt16(0);
    stateEffectId: StateEffectId<Int16> = asInt16(-1);
    stateEffect: StateEffect | null = null;
    technologyType: Int16 = asInt16(0); // used by old AI for tracking similar technologies
    iconNumber: Int16 = asInt16(0);
    researchButtonIndex: UInt8 = asUInt8(0);
    helpDialogStringId: StringId<Int32> = asInt32(-1); // The game actually only supports 16-bit string indexes, higher values will overflow
    helpPageStringId: StringId<Int32> = asInt32(-1);
    hotkeyStringId: StringId<Int32> = asInt32(-1);

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
        this.researchLocationId = buffer.readInt16();
        if (semver.gte(loadingContext.version.numbering, "1.5.0")) {
            this.nameStringId = buffer.readInt16();
            this.researchStringId = buffer.readInt16();
        }
        else {
            this.nameStringId = asInt16(-1);
            this.researchStringId = asInt16(-1);
        }
        this.researchDuration = buffer.readInt16();
        this.stateEffectId = buffer.readInt16();
        this.technologyType = buffer.readInt16();
        this.iconNumber = buffer.readInt16();
        this.researchButtonIndex = buffer.readUInt8();
        if (semver.gte(loadingContext.version.numbering, "2.7.0")) {
            this.helpDialogStringId = buffer.readInt32();
            this.helpPageStringId = buffer.readInt32();
            this.hotkeyStringId = buffer.readInt32();
        }
        this.internalName = buffer.readPascalString16();
        this.referenceId = createSafeFilenameStem(this.internalName);
    }

    isValid() {
        return this.internalName !== "";
    }
    
    linkOtherData(technologies: Nullable<Technology>[], objects: Nullable<SceneryObjectPrototype>[], stateEffects: Nullable<StateEffect>[], loadingContext: LoadingContext) {
        this.prerequisiteTechnologies = this.prerequisiteTechnologyIds.map(technologyId => getDataEntry(technologies, technologyId, "Technology", this.referenceId, loadingContext));
        this.researchLocation = getDataEntry(objects, this.researchLocationId, "ObjectPrototype", this.referenceId, loadingContext);
        this.stateEffect = getDataEntry(stateEffects, this.stateEffectId, "ObjectPrototype", this.referenceId, loadingContext);
    }
    
    writeToJsonFile(directory: string, savingContext: SavingContext) {
        const trimmedPrerequisiteTechnologyIds = trimEnd(this.prerequisiteTechnologyIds, entry => entry === -1);
        const trimmedPrerequisiteTechnologies = this.prerequisiteTechnologies.slice(0, trimmedPrerequisiteTechnologyIds.length);
        writeFileSync(path.join(directory, `${this.referenceId}.json`), createJson({
            ...pick(this, jsonFields),
            resourceCosts: trimEnd(this.resourceCosts, entry => entry.attributeId === -1),
            prerequisiteTechnologyIds: trimmedPrerequisiteTechnologies.map((technology, index) => createReferenceString("Technology", technology?.referenceId, this.prerequisiteTechnologyIds[index])),
            researchLocationId: createReferenceString("ObjectPrototype", this.researchLocation?.referenceId, this.researchLocationId),
            stateEffectId: createReferenceString("StateEffect", this.stateEffect?.referenceId, this.stateEffectId),
        }));
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

export function writeTechnologiesToJsonFiles(outputDirectory: string, technologies: (Technology | null)[], savingContext: SavingContext) {
    const technologiesDirectory = path.join(outputDirectory, "techs");
    clearDirectory(technologiesDirectory);

    technologies.forEach(technology => {
        technology?.writeToJsonFile(technologiesDirectory, savingContext)
    });
    
    writeJsonFileIndex(technologiesDirectory, technologies);
}
