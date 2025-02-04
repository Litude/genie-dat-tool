import semver from "semver";
import BufferReader from "../BufferReader";
import { LoadingContext } from "./LoadingContext";
import { SavingContext } from "./SavingContext";
import { asInt16, asUInt32, Int16, Int16Schema, UInt32, UInt32Schema } from "../ts/base-types";
import { asResourceId, asTribeResourceId, Percentage, ResourceId, ResourceIdSchema, TribeResourceId } from "./Types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";
import { onParsingError } from "./Error";
import path from "path";
import { createReferenceIdFromString } from "../json/reference-id";
import { JsonFieldMapping, transformObjectToJson, writeDataEntriesToJson, writeDataEntryToJsonFile } from "../json/json-serialization";
import { z } from "zod";

interface SoundSample {
    resourceFilename: string;
    resourceId: ResourceId;
    playbackProbability: Percentage<Int16>;
}

const SoundSampleSchema = z.object({
    resourceFilename: z.string(),
    resourceId: ResourceIdSchema,
    playbackProbability: Int16Schema,
})
type SoundSampleJson = z.infer<typeof SoundSampleSchema>;

export const SoundSampleJsonMapping: JsonFieldMapping<SoundSample, SoundSampleJson>[] = [
    { field: "resourceFilename" },
    { field: "resourceId" },
    { field: "playbackProbability" },
];

const SoundEffectSchema = z.object({
    internalName: z.string(),
    playDelay: Int16Schema.optional(),
    samples: z.array(SoundSampleSchema),
    cacheTime: UInt32Schema.optional(),
})
type SoundEffectJson = z.infer<typeof SoundEffectSchema>;

export const SoundEffectJsonMapping: JsonFieldMapping<SoundEffect, SoundEffectJson>[] = [
    { field: "internalName" },
    { field: "playDelay", flags: { internalField: true } },
    { jsonField: "samples", toJson: (obj, savingContext) => obj.samples.map(sample => transformObjectToJson(sample, SoundSampleJsonMapping, savingContext)) },
    { field: "cacheTime", flags: { internalField: true } },
];

export class SoundEffect {
    internalName: string = "";
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
                resourceId: semver.gte(loadingContext.version.numbering, "1.3.1") ? buffer.readInt32<ResourceId>() : asResourceId(buffer.readInt16<TribeResourceId>()),
                playbackProbability: buffer.readInt16(),
            });
        }

        // The original internal name is long lost... Best we can do is to take the filename of the first sample
        let internalName = this.samples.at(0)?.resourceFilename ?? 'Empty';
        internalName = internalName.charAt(0).toUpperCase() + internalName.slice(1);
        if (internalName.endsWith(".wav")) {
            internalName = internalName.slice(0, -4);
        }
        this.internalName = internalName;
        this.referenceId = createReferenceIdFromString(this.internalName);
    }
        
    appendToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext) {
        textFileWriter
            .integer(this.id)
            .integer(this.samples.length)
            .eol()

        for (let j = 0; j < this.samples.length; ++j) {
            const sample = this.samples[j];
            textFileWriter
                .indent(2)
                .integer(semver.gte(savingContext.version.numbering, "1.3.1") ? sample.resourceId : asTribeResourceId(sample.resourceId))
                .filename(sample.resourceFilename)
                .integer(sample.playbackProbability)
                .eol()
        }
    }

    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeDataEntryToJsonFile(directory, this, SoundEffectJsonMapping, savingContext);
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readSoundEffectsFromDatFile(buffer: BufferReader, loadingContext: LoadingContext) {
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

    soundEffects.forEach(soundEffect => {
        soundEffect.appendToTextFile(textFileWriter, savingContext);
    })

    textFileWriter.close();
}

export function writeSoundEffectsToJsonFiles(outputDirectory: string, soundEffects: SoundEffect[], savingContext: SavingContext) {
    writeDataEntriesToJson(outputDirectory, "sounds", soundEffects, SoundEffectJsonMapping, savingContext);
}
