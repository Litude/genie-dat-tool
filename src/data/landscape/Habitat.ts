import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { asInt16, Float32, Int16, TerrainId } from "../Types";
import { Terrain } from './Terrain';
import { SavingContext } from "../SavingContext";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { TextFileNames } from "../../textfile/TextFile";

interface TerrainData {
    terrainId: TerrainId<Int16>;
    terrain: Terrain | null;
    multiplier: Float32;
}
export class Habitat {
    id: Int16 = asInt16(-1); 
    terrainData: TerrainData[] = [];

    constructor(id: number, terrainCount: number, buffer?: BufferReader) {
        this.id = asInt16(id);
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

    linkTerrains(terrains: (Terrain | null)[]) {
        for (let i = 0; i < this.terrainData.length; ++i) {
            this.terrainData[i].terrain = terrains[this.terrainData[i].terrainId];
        }
    }

    writeToWorldTextFile(file: TextFileWriter) {
        // These must be sorted alphabetically
        const sortedTerrainData = [...this.terrainData].sort((a, b) => {
            if (a.terrain && b.terrain) {
                return a.terrain.internalName.localeCompare(b.terrain.internalName)
            }
            else {
                throw new Error(`Tried to write Habitats but terrain was null! Have they been linked?`)
            }
        });

        const validCount = sortedTerrainData.filter(terrainData => terrainData.multiplier).length
        file.integer(this.id).integer(validCount).eol();

        for (let i = 0; i < sortedTerrainData.length; ++i) {
            const terrainData = sortedTerrainData[i];
            if (terrainData.multiplier) {
                file
                    .indent(5)
                    .integer(terrainData.terrainId)
                    .float(terrainData.multiplier)
                    .eol()
            }
        }
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
    console.log(`Parsing habitats, there are ${habitatCount} habitats and ${terrainCount} terrains per habitat`);
    
    for (let i = 0; i < habitatCount; ++i) {
        validHabitats.push(Boolean(buffer.readBool32()))
    }
    console.log(`Valid habitats: ${validHabitats}`);
    for (let i = 0; i < habitatCount; ++i) {
        if (validHabitats[i]) {
            habitats.push(new Habitat(i, terrainCount, buffer));
        }
        else {
            habitats.push(null);
        }
    }
    return habitats;
}

export function writeHabitatsToWorldTextFile(habitats: (Habitat | null)[], terrainCount: number, savingContext: SavingContext) {
    const textFileWriter = new TextFileWriter(TextFileNames.Habitats);

    // Since files don't include rows where the value is zero, count how many entries there are that have non-zero entries
    textFileWriter.raw(habitats.length).eol();
    textFileWriter.raw(terrainCount).eol();
    textFileWriter.raw(" ").eol();

    habitats.forEach(habitat => {
        habitat?.writeToWorldTextFile(textFileWriter);
    })
    textFileWriter.close();
}
