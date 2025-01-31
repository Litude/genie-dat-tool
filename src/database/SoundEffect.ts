import semver from "semver";
import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { asInt16, asInt32, asUInt32, Int16, Int32, Percentage, ResourceId, UInt32 } from "./Types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";
import { onParsingError } from "./Error";
import path from "path";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { createJson, createReferenceIdFromString } from "../json/filenames";

interface SoundSample {
    resourceFilename: string;
    resourceId: ResourceId<Int32>;
    playbackProbability: Percentage<Int16>;
}

export class SoundEffect {
    referenceId: string = ""; // TODO: Pick this from the first sound effect filename instead and ensure it is unique by appending a number or so...
    id: Int16 = asInt16(-1);
    playDelay: Int16 = asInt16(0);
    samples: SoundSample[] = [];
    cacheTime: UInt32 = asUInt32(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext) {
        this.id = buffer.readInt16();
        this.referenceId = `SoundEffect_${id}`;
        if (this.id !== id) {
            onParsingError(`Mismatch between stored Sound Effect id ${this.id} and ordering ${id}, data might be corrupt!`, loadingContext);
        }
        this.playDelay = buffer.readInt16();
        const sampleCount = buffer.readInt16();
        if (semver.gte(loadingContext.version.numbering, "1.3.1")) {
            this.cacheTime = buffer.readUInt32();
        }
        else {
            this.cacheTime = asUInt32(300000);
        }

        this.samples = [];
        for (let i = 0; i < sampleCount; ++i) {
            this.samples.push({
                resourceFilename: buffer.readFixedSizeString(13),
                resourceId: semver.gte(loadingContext.version.numbering, "1.3.1") ? buffer.readInt32() : asInt32(buffer.readInt16()),
                playbackProbability: buffer.readInt16(),
            });
        }

        this.referenceId = createReferenceIdFromString(this.samples.at(0)?.resourceFilename ?? 'Empty');
    }

    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeFileSync(path.join(directory, `${this.referenceId}.json`), createJson({
            samples: this.samples.map(sample => ({
                resourceFilename: sample.resourceFilename,
                resourceId: sample.resourceId,
                playbackProbability: sample.playbackProbability,
            })),
        }));
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readSoundEffects(buffer: BufferReader, loadingContext: LoadingContext) {
    const result: SoundEffect[] = [];
    const soundEffectCount = buffer.readInt16();
    for (let i = 0; i < soundEffectCount; ++i) {
        const soundEffect = new SoundEffect();
        soundEffect.readFromBuffer(buffer, asInt16(i), loadingContext);
        result.push(soundEffect);
    }
    return result;
}

export function writeSoundEffectsToWorldTextFile(outputDirectory: string, soundEffects: SoundEffect[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.SoundEffects));
    textFileWriter.raw(soundEffects.length).eol(); // Total sound effect entries
    textFileWriter.raw(soundEffects.length).eol(); // Entries that have data here (these should always match because there are no null sound entries)

    for (let i = 0; i < soundEffects.length; ++i) {
        const soundEffect = soundEffects[i];
        textFileWriter
            .integer(soundEffect.id)
            .integer(soundEffect.samples.length)
            .eol()

        for (let j = 0; j < soundEffect.samples.length; ++j) {
            const sample = soundEffect.samples[j];
            textFileWriter
                .indent(2)
                .integer(sample.resourceId)
                .filename(sample.resourceFilename)
                .integer(sample.playbackProbability)
                .eol()
        }
    }
    textFileWriter.close();
}

export function writeSoundEffectsToJsonFiles(outputDirectory: string, soundEffects: SoundEffect[], savingContext: SavingContext) {
    const colormapDirectory = path.join(outputDirectory, "sounds");
    rmSync(colormapDirectory, { recursive: true, force: true });
    mkdirSync(colormapDirectory, { recursive: true });

    soundEffects.forEach(soundEffect => {
        soundEffect.writeToJsonFile(colormapDirectory, savingContext);
    });

    const soundEffectIds = soundEffects.map(soundEffect => soundEffect.referenceId);
    writeFileSync(path.join(colormapDirectory, "index.json"), createJson(soundEffectIds));
}
