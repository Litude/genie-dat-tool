import semver from "semver";
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asInt16, Float32, Int16, UInt8 } from "../Types";
import path from "path";
import { clearDirectory } from "../../files/file-utils";
import { createJson, createSafeFilenameStem, writeJsonFileIndex } from "../../json/filenames";
import { isDefined } from "../../ts/ts-utils";
import { writeFileSync } from "fs";

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
        this.referenceId = createSafeFilenameStem(this.internalName);
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

export function writeStateEffectsToJsonFiles(outputDirectory: string, stateEffects: (StateEffect | null)[], savingContext: SavingContext) {
    const stateEffectDirectory = path.join(outputDirectory, "effects");
    clearDirectory(stateEffectDirectory);

    stateEffects.forEach(stateEffect => {
        stateEffect?.writeToJsonFile(stateEffectDirectory, savingContext)
    });
    
    writeJsonFileIndex(stateEffectDirectory, stateEffects);
}
