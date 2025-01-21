import { createWriteStream } from "fs";
import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { asInt16, asUInt32, Int16, Int32, Percentage, ResourceId, UInt32 } from "./Types";
import { EOL } from "os";
import { formatInteger, formatString } from "../Formatting";

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

    constructor(buffer: BufferReader, loadingContext: LoadingContext) {
        this.id = buffer.readInt16();
        this.playDelay = buffer.readInt16();
        const sampleCount = buffer.readInt16();
        this.cacheTime = buffer.readUInt32();

        this.samples = [];
        for (let i = 0; i < sampleCount; ++i) {
            this.samples.push({
                resourceFilename: buffer.readFixedSizeString(13),
                resourceId: buffer.readInt32(),
                playbackProbability: buffer.readInt16()
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
        result.push(new SoundEffect(buffer, loadingContext));
    }
    return result;
}

export function writeSoundEffectsToWorldTextFile(soundEffects: SoundEffect[], savingContext: SavingContext) {
    const writeStream = createWriteStream('tr_snd.txt');
    writeStream.write(`${soundEffects.length}${EOL}`) // Total sound effect entries
    writeStream.write(`${soundEffects.length}${EOL}`) // Entries that have data here (these should always match because there are no null sound entries)

    for (let i = 0; i < soundEffects.length; ++i) {
        const soundEffect = soundEffects[i]
        writeStream.write([
            formatInteger(soundEffect.id),
            formatInteger(soundEffect.samples.length),
            EOL
        ].join(""))

        for (let j = 0; j < soundEffect.samples.length; ++j) {
            const sample = soundEffect.samples[j];
            const filename = sample.resourceFilename.endsWith(".wav") ? sample.resourceFilename.slice(0, -4) : sample.resourceFilename;
            writeStream.write([
                "  ",
                formatInteger(sample.resourceId),
                formatString(filename, 9),
                formatInteger(sample.playbackProbability),
                EOL
            ].join(""))
        }
    }
    writeStream.close();
}
