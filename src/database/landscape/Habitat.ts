import JSON5 from 'json5';
import BufferReader from "../../BufferReader";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { ReferenceStringSchema, TerrainId } from "../Types";
import { Terrain } from './Terrain';
import { SavingContext } from "../SavingContext";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { getDataEntry } from "../../util";
import path from "path";
import { PathLike, readFileSync } from "fs";
import { createReferenceIdFromString, createReferenceString, getIdFromReferenceString } from "../../json/reference-id";
import { applyJsonFieldsToObject, JsonFieldMapping, readJsonFileIndex, transformObjectToJson, writeDataEntriesToJson, writeDataEntryToJsonFile } from "../../json/json-serialization";
import { Logger } from '../../Logger';
import { z } from 'zod';
import { isDefined, Nullable } from '../../ts/ts-utils';
import { asFloat32, asInt16, Float32, Float32Schema, Int16 } from '../../ts/base-types';

interface TerrainData {
    terrainId: TerrainId<Int16>;
    terrain: Terrain | null;
    multiplier: Float32;
}

const TerrainDataSchema = z.object({
    terrainId: ReferenceStringSchema,
    multiplier: Float32Schema
});
type TerrainDataJson = z.infer<typeof TerrainDataSchema>;

export const TerrainDataJsonMapping: JsonFieldMapping<TerrainData, TerrainDataJson>[] = [
    { jsonField: "terrainId", toJson: (obj) => createReferenceString("Terrain", obj.terrain?.referenceId, obj.terrainId) },
    { field: "multiplier" },
];

export const HabitatSchema = z.object({
    internalName: z.string(),
    terrainData: z.array(TerrainDataSchema)
});

type HabitatJson = z.infer<typeof HabitatSchema>;

export const HabitatJsonMapping: JsonFieldMapping<Habitat, HabitatJson>[] = [
    { field: "internalName" },
    { jsonField: "terrainData", toJson: (obj, savingContext) => obj.terrainData
        .map(terrainEntry => transformObjectToJson(terrainEntry, TerrainDataJsonMapping, savingContext))
        .filter(entry => entry.multiplier !== 0) },
    { objectField: "terrainData", fromJson: (json, obj, loadingContext) => {
        const terrainData: TerrainData[] = Array.from({ length: loadingContext.terrainCount }).map((entry, index) => ({
            terrainId: asInt16<TerrainId<Int16>>(index),
            terrain: null,
            multiplier: asFloat32(0),
        }));
        const terrains = json.terrainData.reduce((acc, cur) => ({ ...acc, [getIdFromReferenceString("Terrain", obj.referenceId, cur.terrainId, loadingContext.dataIds.terrainIds)]: cur.multiplier }), {} as Record<number, number>);
        terrainData.forEach((entry, index) => {
            entry.multiplier = asFloat32(terrains[index] ?? 0);
        });
        return terrainData;
    }}
];

export class Habitat {
    referenceId: string = "";
    internalName: string = "";
    id: Int16 = asInt16(-1); 
    terrainData: TerrainData[] = [];

    readFromBuffer(buffer: BufferReader, id: Int16, terrainCount: number, habitatNames: string[]) {
        this.id = asInt16(id);
        this.internalName = habitatNames[id] ?? `Habitat ${this.id}`
        this.referenceId = createReferenceIdFromString(this.internalName);
        this.terrainData = [];
        for (let i = 0; i < terrainCount; ++i) {
            if (buffer) {
                this.terrainData.push({
                    terrainId: asInt16<TerrainId<Int16>>(i),
                    multiplier: buffer.readFloat32(),
                    terrain: null
                });
            }
        }
    }

    readFromJsonFile(jsonFile: HabitatJson, id: Int16, referenceId: string, loadingContext: JsonLoadingContext) {
        this.id = id;
        this.referenceId = referenceId;
        applyJsonFieldsToObject(jsonFile, this, HabitatJsonMapping, loadingContext)
    }

    linkTerrains(terrains: (Terrain | null)[], loadingContext: LoadingContext) {
        for (let i = 0; i < this.terrainData.length; ++i) {
            this.terrainData[i].terrain = getDataEntry(terrains, this.terrainData[i].terrainId, "Terrain", this.referenceId, loadingContext);
        }
    }

    appendToTextFile(file: TextFileWriter) {
        // These must be sorted alphabetically
        const sortedTerrainData = [...this.terrainData].sort((a, b) => {
            if (a.terrain && b.terrain) {
                return textFileStringCompare(a.terrain.internalName, b.terrain.internalName)
            }
            else {
                throw new Error(`Tried to write Habitats but terrain was null! Have they been linked?`)
            }
        });

        const validCount = sortedTerrainData.filter(terrainData => terrainData.multiplier).length
        file.integer(this.id).integer(validCount).eol();

        sortedTerrainData.forEach(terrainData => {
            if (terrainData.multiplier) {
                file
                    .indent(5)
                    .integer(terrainData.terrainId)
                    .float(terrainData.multiplier)
                    .eol()
            }
        });
    }

    writeToJsonFile(directory: string, savingContext: SavingContext) {
        writeDataEntryToJsonFile(directory, this, HabitatJsonMapping, savingContext);
    }

    toString() {
        return this.terrainData.map(terrainData => terrainData.multiplier.toFixed(6)).join(', ');
    }

}


export function readHabitatNamesFromJsonFile(path: PathLike): string[] {
    try {
        const rawTextData = readFileSync(path);
        if (rawTextData) {
            const habitatNamesText = rawTextData.toString('latin1')
            const parsedHabitatNames = JSON5.parse(habitatNamesText);
            const verifiedHabitatNames = z.array(z.string()).parse(parsedHabitatNames);
            return verifiedHabitatNames;
        }
        else {
            return [];
        }
    } catch (err: unknown) {
        if (err instanceof Error) {
            Logger.error(err.message);
        }
        return [];
    }
}


export function readHabitatsFromDatFile(buffer: BufferReader, habitatNames: string[], loadingContext: LoadingContext): Nullable<Habitat>[] {
    const habitats: Nullable<Habitat>[] = [];
    const validHabitats: boolean[] = [];
    const habitatCount = buffer.readInt16()
    const terrainCount = buffer.readInt16();
    
    for (let i = 0; i < habitatCount; ++i) {
        validHabitats.push(Boolean(buffer.readBool32()))
    }
    for (let i = 0; i < habitatCount; ++i) {
        if (validHabitats[i]) {
            const habitat = new Habitat();
            habitat.readFromBuffer(buffer, asInt16(i), terrainCount, habitatNames);
            habitats.push(habitat);
        }
        else {
            habitats.push(null);
        }
    }
    return habitats;
}

export function readHabitatsFromJsonFiles(inputDirectory: string, terrainCount: number, habitatIds: (string | null)[], loadingContext: JsonLoadingContext) {
    const habitatDirectory = path.join(inputDirectory, 'habitats');
    const habitats: Nullable<Habitat>[] = [];
    habitatIds.forEach((habitatId, index) => {
        if (habitatId !== null) {
            const habitatJson = HabitatSchema.parse(JSON5.parse(readFileSync(path.join(habitatDirectory, `${habitatId}.json`)).toString('utf8')));
            const habitat = new Habitat();
            habitat.readFromJsonFile(habitatJson, asInt16(index), habitatId, loadingContext);
            habitats.push(habitat);
        }
        else {
            habitats.push(null);
        }
    })
    return habitats;
}

export function writeHabitatsToWorldTextFile(outputDirectory: string, habitats: Nullable<Habitat>[], terrainCount: number, savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Habitats));

    textFileWriter.raw(habitats.length).eol();
    textFileWriter.raw(terrainCount).eol();
    textFileWriter.raw(" ").eol();
    
    const sortedHabitats = [...habitats].filter(isDefined).sort((a, b) => textFileStringCompare(a.internalName, b.internalName));

    sortedHabitats.forEach(habitat => {
        habitat?.appendToTextFile(textFileWriter);
    })
    textFileWriter.close();
}

export function writeHabitatsToJsonFiles(outputDirectory: string, habitats: Nullable<Habitat>[], savingContext: SavingContext) {
    writeDataEntriesToJson(outputDirectory, "habitats", habitats, savingContext);
}

export function readHabitatIdsFromJsonIndex(inputDirectory: string) {
    return readJsonFileIndex(path.join(inputDirectory, "habitats"));
}
