import semver from "semver";
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asInt16, Float32, Int16, UInt8 } from "../../ts/base-types";
import path from "path";
import { clearDirectory } from "../../files/file-utils";
import { createReferenceIdFromString } from "../../json/reference-id";
import { isDefined, Nullable } from "../../ts/ts-utils";
import { writeFileSync } from "fs";
import { Civilization } from "../Civilization";
import { Technology } from "./Technology";
import { createJson, writeJsonFileIndex } from "../../json/json-serialization";

interface EffectCommand {
    commandType: UInt8;
    value1: Int16;
    value2: Int16;
    value3: Int16;
    value4: Float32;
}

export class StateEffect {
    referenceId: string = "";
    id: Int16 = asInt16(-1);
    internalName: string = "";
    commands: EffectCommand[] = [];

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        this.id = id;
        this.internalName = buffer.readFixedSizeString(31);
        // TODO: Some other way of generating a reference id since all original names have been lost?
        this.referenceId = createReferenceIdFromString(this.internalName);
        const commandCount = buffer.readInt16();
        this.commands = [];
        for (let i = 0; i < commandCount; ++i) {
            this.commands.push({
                commandType: buffer.readUInt8(),
                value1: buffer.readInt16(),
                value2: buffer.readInt16(),
                value3: buffer.readInt16(),
                value4: buffer.readFloat32(),
            });
        }
    }

    isValid() {
        return this.internalName !== "";
    }

    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeFileSync(path.join(directory, `${this.referenceId}.json`), createJson({
            internalName: this.internalName,
            commands: this.commands,
        }));
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readStateEffects(buffer: BufferReader, loadingContext: LoadingContext): (StateEffect | null)[] {
    const result: (StateEffect | null)[] = [];
    const effectCount = buffer.readInt32();
    for (let i = 0; i < effectCount; ++i) {
        const stateEffect = new StateEffect();
        stateEffect.readFromBuffer(buffer, asInt16(i), loadingContext);
        result.push(stateEffect.isValid() ? stateEffect : null);
    }

    return result;
}

// this format has changed a lot since the alpha days...
export function writeStateEffectsToWorldTextFile(outputDirectory: string, effects: (StateEffect | null)[], savingContext: SavingContext) { 
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.StateEffects));
    textFileWriter.raw(effects.length).eol(); // Total state effect entries
    const validEntries = effects.filter(isDefined);
    if (semver.gte(savingContext.version.numbering, "2.0.0")) {
        textFileWriter.raw(validEntries.length).eol(); // Entries that have data
    }
    if (validEntries.length !== effects.length && semver.lt(savingContext.version.numbering, "2.0.0")) {
        throw new Error("Saving dummy effect entries not implemented for version < 2.0");
    }

    for (let i = 0; i < validEntries.length; ++i) {
        const effect = validEntries[i];
        textFileWriter
            .conditional(semver.gte(savingContext.version.numbering, "2.0.0"), writer => writer.integer(effect.id))
            .string(effect.internalName.replaceAll(' ', '_'), 17)
            .integer(effect.commands.length)
            .eol();

        for (let j = 0; j < effect.commands.length; ++j) {
            const command = effect.commands[j];
            textFileWriter
                .indent(9)
                .integer(command.commandType)
                .integer(command.value1)
                .integer(command.value2)
                .integer(command.value3)
                .float(command.value4)
                .eol();
        }
    }
    textFileWriter.close();
}

export function createFallbackStateEffectReferenceIdsIfNeeded(stateEffects: Nullable<StateEffect>[], technologies: Nullable<Technology>[], civilizations: Nullable<Civilization>[], hardcodedNames: Record<number, string> = {}) {
    const uniqueStateEffectNames = new Set([...stateEffects.filter(isDefined).map(stateEffect => stateEffect?.internalName)]);
    if (uniqueStateEffectNames.size === 1) {
        stateEffects.forEach(effect => {
            if (effect) {
                effect.referenceId = "";
            }
        });
        technologies.filter(isDefined).forEach(technology => {
            if (technology.stateEffectId >= 0 && technology.stateEffectId < stateEffects.length) {
                const stateEffect = stateEffects[technology.stateEffectId];
                if (stateEffect) {
                    stateEffect.referenceId = createReferenceIdFromString(`Tech ${technology.internalName}`);
                }
            }
        });
        civilizations.filter(isDefined).forEach(civilization => {
            if (civilization.bonusEffectId >= 0 && civilization.bonusEffectId < stateEffects.length) {
                const stateEffect = stateEffects[civilization.bonusEffectId];
                if (stateEffect) {
                    stateEffect.referenceId = createReferenceIdFromString(`Civ ${civilization.internalName}`);
                }
            }
        });
        for (const [key, value] of Object.entries(hardcodedNames)) {
            const stateEffect = stateEffects[+key];
            if (stateEffect?.referenceId === "") {
                stateEffect.referenceId = createReferenceIdFromString(value);
            }
        }
        const defaultName = [...uniqueStateEffectNames.values()][0];
        stateEffects.forEach(effect => {
            if (effect?.referenceId === "") {
                if (effect.commands.length === 0) {
                    effect.referenceId = "None";
                }
                else {
                    effect.referenceId = createReferenceIdFromString(defaultName);
                }
            }
        });
    }
}

export function writeStateEffectsToJsonFiles(outputDirectory: string, stateEffects: (StateEffect | null)[], savingContext: SavingContext) {
    const stateEffectDirectory = path.join(outputDirectory, "effects");
    clearDirectory(stateEffectDirectory);

    stateEffects.forEach(stateEffect => {
        stateEffect?.writeToJsonFile(stateEffectDirectory, savingContext)
    });
    
    writeJsonFileIndex(stateEffectDirectory, stateEffects);
}
