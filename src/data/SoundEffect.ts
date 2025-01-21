import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { asInt16, asUInt32, Int16, Int32, Percentage, ResourceId, UInt32 } from "./Types";

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
