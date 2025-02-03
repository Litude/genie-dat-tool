import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { asInt16, Float32, Int16, TerrainId } from "../Types";
import { Terrain } from './Terrain';
import { SavingContext } from "../SavingContext";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { TextFileNames, textFileStringCompare } from "../../textfile/TextFile";
import { getDataEntry } from "../../util";
import path from "path";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { createReferenceString } from "../../json/reference-id";
import { createJson } from "../../json/json-serialization";

interface TerrainData {
    terrainId: TerrainId<Int16>;
    terrain: Terrain | null;
    multiplier: Float32;
}
export class Habitat {
    referenceId: string = "";
    internalName: string = "";
    id: Int16 = asInt16(-1); 
    terrainData: TerrainData[] = [];

    readFromBuffer(buffer: BufferReader, id: Int16, terrainCount: number) {
        this.id = asInt16(id);
        this.referenceId = `Habitat_${this.id}`;
        this.terrainData = [];
        for (let i = 0; i < terrainCount; ++i) {
            if (buffer) {
                this.terrainData.push({
                    terrainId: asInt16(i),
                    multiplier: buffer.readFloat32(),
                    terrain: null
                });
            }
        }
    }

    linkTerrains(terrains: (Terrain | null)[], loadingContext: LoadingContext) {
        for (let i = 0; i < this.terrainData.length; ++i) {
            this.terrainData[i].terrain = getDataEntry(terrains, this.terrainData[i].terrainId, "Terrain", this.referenceId, loadingContext);
        }
    }

    writeToWorldTextFile(file: TextFileWriter) {
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
    
        writeFileSync(path.join(directory, `${this.referenceId}.json`), createJson({
            terrainData: this.terrainData.filter(entry => entry.multiplier).map(terrainEntry => {
                return {
                    terrainId: createReferenceString("Terrain", terrainEntry.terrain?.referenceId, terrainEntry.terrainId),
                    multiplier: terrainEntry.multiplier
                }
            })
        }));
    }

    toString() {
        return this.terrainData.map(terrainData => terrainData.multiplier.toFixed(6)).join(', ');
    }


}

export function readHabitats(buffer: BufferReader, loadingContext: LoadingContext): (Habitat | null)[] {
    const habitats: (Habitat | null)[] = [];
    const validHabitats: boolean[] = [];
    const habitatCount = buffer.readInt16()
    const terrainCount = buffer.readInt16();
    
    for (let i = 0; i < habitatCount; ++i) {
        validHabitats.push(Boolean(buffer.readBool32()))
    }
    for (let i = 0; i < habitatCount; ++i) {
        if (validHabitats[i]) {
            const habitat = new Habitat();
            habitat.readFromBuffer(buffer, asInt16(i), terrainCount);
            habitats.push(habitat);
        }
        else {
            habitats.push(null);
        }
    }
    return habitats;
}

export function writeHabitatsToWorldTextFile(outputDirectory: string, habitats: (Habitat | null)[], terrainCount: number, savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.Habitats));

    textFileWriter.raw(habitats.length).eol();
    textFileWriter.raw(terrainCount).eol();
    textFileWriter.raw(" ").eol();

    habitats.forEach(habitat => {
        habitat?.writeToWorldTextFile(textFileWriter);
    })
    textFileWriter.close();
}

export function writeHabitatsToJsonFiles(outputDirectory: string, habitats: (Habitat | null)[], savingContext: SavingContext) {
    const habitatDirectory = path.join(outputDirectory, "habitats");
    rmSync(habitatDirectory, { recursive: true, force: true });
    mkdirSync(habitatDirectory, { recursive: true });

    habitats.forEach(habitat => {
        habitat?.writeToJsonFile(habitatDirectory, savingContext)
    });
    
    const habitatIds = habitats.map(habitat => habitat?.referenceId ?? null);
    writeFileSync(path.join(habitatDirectory, "index.json"), JSON.stringify(habitatIds, undefined, 4));
}
