import semver from "semver";
import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { asInt16, asInt32, asUInt32, Int16, Int32, Percentage, ResourceId, UInt32 } from "./Types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";
import { Logger } from "../Logger";

interface SoundSample {
    resourceFilename: string;
    resourceId: ResourceId<Int32>;
    playbackProbability: Percentage<Int16>;
}

export class SoundEffect {
    id: Int16; // todo: check if this matches index?
    playDelay: Int16 = asInt16(0);
    samples: SoundSample[];
    cacheTime: UInt32 = asUInt32(0);

    constructor(buffer: BufferReader, id: Int16, loadingContext: LoadingContext) {
        this.id = buffer.readInt16();
        if (this.id !== id) {
            Logger.warn(`Mismatch between stored Sound Effect id ${this.id} and ordering ${id}, data might be corrupt!`);
        }
        this.playDelay = buffer.readInt16();
        const sampleCount = buffer.readInt16();
        if (semver.gte(loadingContext.version.numbering, "1.3.1")) {
            this.cacheTime = buffer.readUInt32();
        }

        this.samples = [];
        for (let i = 0; i < sampleCount; ++i) {
            this.samples.push({
                resourceFilename: buffer.readFixedSizeString(13),
                resourceId: semver.gte(loadingContext.version.numbering, "1.3.1") ? buffer.readInt32() : asInt32(buffer.readInt16()),
                playbackProbability: buffer.readInt16(),
            });
        }
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readSoundEffects(buffer: BufferReader, loadingContext: LoadingContext) {
    const result: SoundEffect[] = [];
    const soundEffectCount = buffer.readInt16();
    for (let i = 0; i < soundEffectCount; ++i) {
        result.push(new SoundEffect(buffer, asInt16(i), loadingContext));
    }
    return result;
}

export function writeSoundEffectsToWorldTextFile(soundEffects: SoundEffect[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.SoundEffects);
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
