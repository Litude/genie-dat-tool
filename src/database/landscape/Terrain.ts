import semver from "semver";
import BufferReader from "../../BufferReader";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { isDefined, Nullable } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { LoadingContext } from "../LoadingContext";
import { SceneryObjectPrototype } from "../object/SceneryObjectPrototype";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import { BorderId, PaletteIndex, PaletteIndexSchema, PrototypeId, ReferenceStringSchema, ResourceId, TerrainId } from "../Types";
import { asInt16, asInt32, asUInt16, asUInt8, Bool8, Int16, Int16Schema, UInt16, UInt8Schema } from "../../ts/base-types";
import { Border } from "./Border";
import { onParsingError } from "../Error";
import path from "path";
import { createReferenceString, createReferenceIdFromString } from "../../json/reference-id";
import { z } from "zod";
import { BaseTerrainAnimation, BaseTerrainFrameMap, BaseTerrainFrameMapJsonMapping, BaseTerrainJsonMapping, BaseTerrainTile, BaseTerrainTileSchema } from "./BaseTerrainTile";
import { JsonFieldMapping, transformObjectToJson, writeDataEntryToJsonFile, writeDataEntriesToJson, readJsonFileIndex } from "../../json/json-serialization";

interface TerrainObjectPlacement {
    prototypeId: PrototypeId<Int16>;
    object: SceneryObjectPrototype | null;
    density: Int16;
    centralize: Bool8;
}

const TerrainSchema = BaseTerrainTileSchema.merge(z.object({
    minimapCliffColor1: PaletteIndexSchema,
    minimapCliffColor2: PaletteIndexSchema,
    terrainPatternWidth: Int16Schema,
    terrainPatternHeight: Int16Schema,
    passableTerrainId: ReferenceStringSchema,
    impassableTerrainId: ReferenceStringSchema,
    renderedTerrainId: ReferenceStringSchema,
    borders: z.array(z.object({
        borderId: ReferenceStringSchema,
        terrainId: ReferenceStringSchema,
    })),
    objectPlacements: z.array(z.object({
        prototypeId: ReferenceStringSchema,
        density: Int16Schema,
        centralize: z.boolean()
    })).max(30),
    frameMaps: z.array(z.object({
        frameCount: Int16Schema,
        animationFrames: Int16Schema,
        frameIndex: Int16Schema.optional()
    })).length(19)
}));

type TerrainJson = z.infer<typeof TerrainSchema>;

const TerrainJsonMapping: JsonFieldMapping<Terrain, TerrainJson>[] = [
    ...BaseTerrainJsonMapping,
    { field: "minimapCliffColor1" },
    { field: "minimapCliffColor2" },
    { field: "terrainPatternWidth" },
    { field: "terrainPatternHeight" },
    { jsonField: "passableTerrainId", toJson: (obj, savingContext) => createReferenceString("Terrain", obj.passableTerrain?.referenceId, obj.passableTerrainId) },
    { jsonField: "impassableTerrainId", toJson: (obj, savingContext) => createReferenceString("Terrain", obj.impassableTerrain?.referenceId, obj.impassableTerrainId) },
    { jsonField: "renderedTerrainId", toJson: (obj, savingContext) => createReferenceString("Terrain", obj.renderedTerrain?.referenceId, obj.renderedTerrainId) },
    { jsonField: "borders", toJson: (obj, savingContext) => obj.borderTypes.map((entry, index) => {
        if (entry?.border) {
            return {
                borderId: createReferenceString("Border", entry.border.referenceId, obj.borderTypeIds[index]),
                terrainId: createReferenceString("Terrain", entry.terrain?.referenceId, index)
            }
        }
        else {
            return null
        }
    }).filter(isDefined)},
    { jsonField: "objectPlacements", toJson: (obj, savingContext) => obj.objectPlacements.map(objectPlacement => ({
        prototypeId: createReferenceString("ObjectPrototype", objectPlacement.object?.referenceId, objectPlacement.prototypeId),
        density: objectPlacement.density,
        centralize: objectPlacement.centralize
    }))},
    { jsonField: "frameMaps", toJson: (obj, savingContext) => obj.frameMaps.map(frameMapEntry => transformObjectToJson(frameMapEntry, BaseTerrainFrameMapJsonMapping, savingContext)) }
];

export class Terrain extends BaseTerrainTile {
    minimapCliffColor1: PaletteIndex = asUInt8<PaletteIndex>(0);
    minimapCliffColor2: PaletteIndex = asUInt8<PaletteIndex>(0);
    passableTerrainId: TerrainId<Int16> = asInt16(-1); // Note! This is stored as 8 bits in the data!
    passableTerrain: Terrain | null = null;
    impassableTerrainId: TerrainId<Int16> = asInt16(-1); // Note! This is stored as 8 bits in the data!
    impassableTerrain: Terrain | null = null;

    frameMaps: BaseTerrainFrameMap[] = [];
    renderedTerrainId: TerrainId<Int16> = asInt16(-1);
    renderedTerrain: Terrain | null = null;
    terrainPatternHeight: Int16 = asInt16(0);
    terrainPatternWidth: Int16 = asInt16(0);
    borderTypeIds: BorderId<Int16>[] = [];
    borderTypes: (({ border: Border | null, terrain: Terrain | null }) | null)[] = [];
    objectPlacements: TerrainObjectPlacement[] = [];
    padding0196: UInt16 = asUInt16(0);

    readFromBuffer(buffer: BufferReader, id: Int16, soundEffects: SoundEffect[], loadingContext: LoadingContext): void {
        this.id = id;
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

        this.graphicPointer = buffer.readPointer();
        this.soundEffectId = buffer.readInt32();
        this.soundEffect = getDataEntry(soundEffects, this.soundEffectId, "SoundEffect", this.referenceId, loadingContext);

        this.minimapColor1 = buffer.readUInt8<PaletteIndex>();
        this.minimapColor2 = buffer.readUInt8<PaletteIndex>();
        this.minimapColor3 = buffer.readUInt8<PaletteIndex>();
        this.minimapCliffColor1 = buffer.readUInt8<PaletteIndex>();
        this.minimapCliffColor2 = buffer.readUInt8<PaletteIndex>();

        const rawPassableTerrainId = buffer.readUInt8()
        this.passableTerrainId = asInt16(rawPassableTerrainId === 255 ? -1 : rawPassableTerrainId);
        const rawImpassableTerrainId = buffer.readUInt8();
        this.impassableTerrainId = asInt16(rawImpassableTerrainId === 255 ? -1 : rawImpassableTerrainId);

        this.animation = BaseTerrainAnimation.readFromBuffer(buffer, loadingContext);

        this.drawCount = buffer.readUInt8();

        this.frameMaps = [];
        for (let i = 0; i < 19; ++i) {
            this.frameMaps.push({
                frameCount: buffer.readInt16(),
                animationFrames: buffer.readInt16(),
                frameIndex: buffer.readInt16()
            });
        }
        this.renderedTerrainId = buffer.readInt16();
        this.terrainPatternHeight = buffer.readInt16();
        this.terrainPatternWidth = buffer.readInt16();

        this.borderTypeIds = [];
        for (let i = 0; i < 32; ++i) {
            this.borderTypeIds.push(buffer.readInt16());
        }

        const placementObjectTypes: PrototypeId<Int16>[] = [];
        const placementObjectDensities: Int16[] = [];
        const placementObjectCentralize: Bool8[] = [];
        for (let i = 0; i < 30; ++i) {
            placementObjectTypes.push(buffer.readInt16());
        }
        for (let i = 0; i < 30; ++i) {
            placementObjectDensities.push(buffer.readInt16());
        }
        for (let i = 0; i < 30; ++i) {
            placementObjectCentralize.push(buffer.readBool8());
        }
        const placementObjectCount = buffer.readInt16();
        this.objectPlacements = [];
        for (let i = 0; i < placementObjectCount; ++i) {
            this.objectPlacements.push({
                prototypeId: placementObjectTypes[i],
                object: null,
                density: placementObjectDensities[i],
                centralize: placementObjectCentralize[i]
            });
        }
        
        this.padding0196 = buffer.readUInt16();
    }

    linkOtherData(terrains: (Terrain | null)[], borders: (Border | null)[], objects: (SceneryObjectPrototype | null)[], loadingContext: LoadingContext) {
        this.passableTerrain = this.passableTerrainId !== 255 ? getDataEntry(terrains, this.passableTerrainId, "Terrain", this.referenceId, loadingContext) : null;
        this.impassableTerrain = this.impassableTerrainId !== 255 ? getDataEntry(terrains, this.impassableTerrainId, "Terrain", this.referenceId, loadingContext) : null;
        this.renderedTerrain = getDataEntry(terrains, this.renderedTerrainId, "Terrain", this.referenceId, loadingContext);
        this.borderTypes = this.borderTypeIds.map((borderId, terrainId) => {
            if (borderId > 0) {
                return {
                    border: getDataEntry(borders, borderId, "Border", this.referenceId, loadingContext),
                    terrain: getDataEntry(terrains, terrainId, "Terrain", this.referenceId, loadingContext)
                }
            }
            else {
                return null;
            }
        });
        this.objectPlacements.forEach(placement => {
            placement.object = getDataEntry(objects, placement.prototypeId, "ObjectPrototype", this.referenceId, loadingContext);
        });
    }
    
    appendToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext) {
        super.appendToTextFile(textFileWriter, savingContext);

        const borderEntries = [...this.borderTypes].sort((a, b) => {
            if (a?.terrain && b?.terrain) {
                return textFileStringCompare(a.terrain.internalName, b.terrain.internalName);
            }
            else {
                return a?.terrain ? 1 : - 1;
            }
        });
        const borderCount = borderEntries.filter(entry => entry?.border).length;
        textFileWriter
            .integer(this.renderedTerrainId)
            .integer(this.terrainPatternHeight)
            .integer(this.terrainPatternWidth)
            .integer(this.minimapCliffColor1)
            .integer(this.minimapCliffColor2)
            .integer(this.impassableTerrainId)
            .integer(this.passableTerrainId)
            .integer(borderCount);
        for (let j = 0; j < 19; ++j) {
            textFileWriter
                .integer(this.frameMaps[j].frameCount)
                .integer(this.frameMaps[j].animationFrames);
        }
        for (let j = 0; j < this.borderTypes.length; ++j) {
            const borderEntry = borderEntries[j];
            if (borderEntry?.border) {
                textFileWriter
                    .integer(borderEntry.terrain?.id ?? -1)
                    .integer(borderEntry.border.id);
            }
        }
        textFileWriter.eol();
    }

    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeDataEntryToJsonFile(directory, this, TerrainJsonMapping, savingContext);
    }

    toString() {
        return JSON.stringify(this);
    }
}

export function readTerrainsFromDatFile(buffer: BufferReader, soundEffects: SoundEffect[], loadingContext: LoadingContext): Nullable<Terrain>[] {
    const result: Nullable<Terrain>[] = [];
    for (let i = 0; i < 32; ++i) {
        const terrain = new Terrain();
        terrain.readFromBuffer(buffer, asInt16(i), soundEffects, loadingContext);
        result.push(terrain.enabled ? terrain : null);
    }
    return result;
}

export function readAndVerifyTerrainCountFromDatFile(terrains: Nullable<Terrain>[], buffer: BufferReader, loadingContext: LoadingContext) {
    const terrainCount = buffer.readInt16();
    if (terrainCount !== terrains.filter(x => x).length) {
        onParsingError(`Mismatch between enabled terrains and terrain count, DAT might be corrupt!`, loadingContext);
    }
}

function writeTerrainObjectsToWorldTextFile(outputDirectory: string, terrains: Nullable<Terrain>[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.TerrainObjects));
    const parsedEntries = [...terrains]
        .filter(isDefined)
        .sort((a, b) => textFileStringCompare(a.internalName, b.internalName))
        .flatMap(terrain => terrain.objectPlacements.map(placement => ({ ...placement, terrainId: terrain.id })));
    textFileWriter.raw(parsedEntries.length).eol();

    parsedEntries.forEach(entry => {
        if (entry.prototypeId >= 0) {
            textFileWriter
                .integer(entry.terrainId)
                .integer(entry.prototypeId)
                .integer(entry.density)
                .integer(entry.centralize ? 1 : 0)
                .eol()
        }
    });
    textFileWriter.close();
}

export function writeTerrainsToWorldTextFile(outputDirectory: string, terrains: Nullable<Terrain>[], savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Terrains));
    textFileWriter.raw(terrains.filter(isDefined).length).eol(); // Total terrain entries
    const sortedTerrains = [...terrains].filter(isDefined).sort((a, b) => textFileStringCompare(a.internalName, b.internalName));

    sortedTerrains.forEach(terrain => {
        terrain.appendToTextFile(textFileWriter, savingContext);
    });

    textFileWriter.close();
    writeTerrainObjectsToWorldTextFile(outputDirectory, terrains, savingContext);
}

export function writeTerrainsToJsonFiles(outputDirectory: string, terrains: Nullable<Terrain>[], savingContext: SavingContext) {
    writeDataEntriesToJson(outputDirectory, "terrains", terrains, TerrainJsonMapping, savingContext);
}

export function readTerrainIdsFromJsonIndex(inputDirectory: string) {
    return readJsonFileIndex(path.join(inputDirectory, "terrains"));
}
