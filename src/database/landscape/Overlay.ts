import JSON5 from 'json5';
import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined, Nullable } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import { PaletteIndex, ResourceId } from "../Types";
import { asBool8, asInt16, asInt32, asUInt8, Bool8, Bool8Schema, Int16, UInt8 } from "../../ts/base-types";
import { onParsingError } from '../Error';
import path from 'path';
import { createReferenceIdFromString } from '../../json/reference-id';
import { BaseTerrainAnimation, BaseTerrainFrameMap, BaseTerrainFrameMapJsonMapping, BaseTerrainFrameMapSchema, BaseTerrainTile, BaseTerrainTileSchema } from './BaseTerrainTile';
import { applyJsonFieldsToObject, JsonFieldMapping, readJsonFileIndex, transformObjectToJson, writeDataEntriesToJson } from '../../json/json-serialization';
import { z } from 'zod';
import { readFileSync } from 'fs';

const OverlaySchema = BaseTerrainTileSchema.merge(z.object({
    frameMaps: z.array(z.array(BaseTerrainFrameMapSchema).length(16)).length(19),
    drawTerrain: Bool8Schema,
}));

type OverlayJson = z.infer<typeof OverlaySchema>;

const OverlayJsonMapping: JsonFieldMapping<Overlay, OverlayJson>[] = [
    { jsonField: "frameMaps", toJson: (obj, savingContext) => obj.frameMaps.map(frameMapEntries => frameMapEntries.map(frameMapEntry => transformObjectToJson(frameMapEntry, BaseTerrainFrameMapJsonMapping, savingContext))) },
    { objectField: "frameMaps", fromJson: (json, obj, loadingContext) => {
        let frameCounter = 0;
        return json.frameMaps.map(nestedMap => nestedMap.map(entry => {
            let frameIndex = frameCounter;
            frameCounter += entry.frameCount * entry.animationFrames;
            return {
                frameCount: entry.frameCount,
                animationFrames: entry.animationFrames,
                frameIndex: entry.frameIndex === undefined ? asInt16(frameIndex) : entry.frameIndex,
            }
        }));
    }},
    { field: "drawTerrain" }
];

export class Overlay extends BaseTerrainTile {
    frameMaps: BaseTerrainFrameMap[][] = [];
    drawTerrain: Bool8 = asBool8(false);
    padding59B: UInt8 = asUInt8(0);

    readFromBuffer(buffer: BufferReader, id: Int16, soundEffects: SoundEffect[], loadingContext: LoadingContext): void {
        this.id = id
        this.enabled = buffer.readBool8();
        this.random = buffer.readBool8();

        this.internalName = buffer.readFixedSizeString(13);
        this.referenceId = createReferenceIdFromString(this.internalName);
        this.resourceFilename = buffer.readFixedSizeString(13);
        if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
            this.resourceId = buffer.readInt32<ResourceId>();
        }
        else {
            this.resourceId = asInt32<ResourceId>(-1);
        }

        // NOTE: Unlike terrains and borders, here the sound effect comes first and then the graphic
        this.soundEffectId = buffer.readInt32();
        this.soundEffect = getDataEntry(soundEffects, this.soundEffectId, "SoundEffect", this.referenceId, loadingContext);
        this.graphicPointer = buffer.readPointer();

        this.minimapColor1 = buffer.readUInt8<PaletteIndex>();
        this.minimapColor2 = buffer.readUInt8<PaletteIndex>();
        this.minimapColor3 = buffer.readUInt8<PaletteIndex>();

        this.animation = BaseTerrainAnimation.readFromBuffer(buffer, loadingContext);

        this.drawCount = buffer.readUInt8();        

        this.frameMaps = [];
        for (let i = 0; i < 19; ++i) {
            this.frameMaps.push([]);
            for (let j = 0; j < 16; ++j) {
                this.frameMaps[i].push({
                    frameCount: buffer.readInt16(),
                    animationFrames: buffer.readInt16(),
                    frameIndex: buffer.readInt16()
                });
            }
        }
        this.drawTerrain = buffer.readBool8();
        this.padding59B = buffer.readUInt8();
    }

    readFromJsonFile(jsonFile: OverlayJson, id: Int16, referenceId: string, soundEffects: SoundEffect[], loadingContext: JsonLoadingContext) {
        super.readFromJsonFile(jsonFile, id, referenceId, soundEffects, loadingContext);
        applyJsonFieldsToObject(jsonFile, this, OverlayJsonMapping, loadingContext);
    }
    
    appendToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext) {
        super.appendToTextFile(textFileWriter, savingContext);

        textFileWriter
            .integer(this.drawTerrain ? 1 : 0)
        
        for (let j = 0; j < 19; ++j) {
            for (let k = 0; k < 16; ++k) {
                textFileWriter
                    .integer(this.frameMaps[j][k].frameCount)
                    .integer(this.frameMaps[j][k].animationFrames);
            }
        }
        textFileWriter.eol();
        textFileWriter.raw(" ").eol();
    }
    
    toJson(savingContext: SavingContext) {
        return {
            ...super.toJson(savingContext),
            ...transformObjectToJson(this, OverlayJsonMapping, savingContext)
        }
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readOverlaysFromDatFile(buffer: BufferReader, soundEffects: SoundEffect[], loadingContext: LoadingContext): Nullable<Overlay>[] {
    const result: Nullable<Overlay>[] = [];
    if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
        for (let i = 0; i < 16; ++i) {
            const overlay = new Overlay();
            overlay.readFromBuffer(buffer, asInt16(i), soundEffects, loadingContext);
            result.push(overlay.enabled ? overlay : null);
        }
    }
    return result;
}

export function readAndVerifyOverlayCountFromDatFile(overlays: Nullable<Overlay>[], buffer: BufferReader, loadingContext: LoadingContext) {
    if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
        const overlayCount = buffer.readInt16();
        if (overlayCount !== overlays.filter(isDefined).length) {
            onParsingError(`Mismatch between enabled overlays and overlay count, DAT might be corrupt!`, loadingContext)
        }
    }
}

export function readOverlaysFromJsonFiles(inputDirectory: string, overlayIds: (string | null)[], soundEffects: SoundEffect[], loadingContext: JsonLoadingContext) {
    const overlaysDirectory = path.join(inputDirectory, 'overlays');
    const overlays: Nullable<Overlay>[] = [];
    overlayIds.forEach((overlayReferenceId, overlayNumberId) => {
        if (overlayReferenceId === null) {
            overlays.push(null);
        }
        else {
            const overlayJson = OverlaySchema.parse(JSON5.parse(readFileSync(path.join(overlaysDirectory, `${overlayReferenceId}.json`)).toString('utf8')));
            const overlay = new Overlay();
            overlay.readFromJsonFile(overlayJson, asInt16(overlayNumberId), overlayReferenceId, soundEffects, loadingContext);
            overlays.push(overlay);
        }

    })
    return overlays;
}


export function writeOverlaysToWorldTextFile(outputDirectory: string, overlays: Nullable<Overlay>[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Overlays));
    textFileWriter.raw(overlays.filter(isDefined).length).eol(); // Total overlay entries
    const sortedOverlays = [...overlays].filter(isDefined).sort((a, b) => textFileStringCompare(a.internalName, b.internalName));
    sortedOverlays.forEach(overlay => {
        overlay.appendToTextFile(textFileWriter, savingContext);
    })

    textFileWriter.close();
}

export function writeOverlaysToJsonFiles(outputDirectory: string, overlays: Nullable<Overlay>[], savingContext: SavingContext) {
    if (semver.lt(savingContext.version.numbering, "2.0.0")) {
        writeDataEntriesToJson(outputDirectory, "overlays", overlays, savingContext);
    }
}

export function readOverlayIdsFromJsonIndex(inputDirectory: string) {
    try {
        return readJsonFileIndex(path.join(inputDirectory, "overlays"));
    }
    catch (err: unknown) {
        return [];
    }
}
