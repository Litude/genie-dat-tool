import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { Float32 } from "../Types";

export class Habitat {
    multipliers: Float32[];

    constructor(terrainCount: number, buffer?: BufferReader) {
        this.multipliers = [];
        for (let i = 0; i < terrainCount; ++i) {
            if (buffer) {
                this.multipliers.push(buffer.readFloat32());
            }
        }
    }

    toString() {
        return this.multipliers.map(multiplier => multiplier.toFixed(6)).join(', ');
    }
}

export function readHabitats(buffer: BufferReader, loadingContent: LoadingContext): (Habitat | null)[] {
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
            habitats.push(new Habitat(terrainCount, buffer));
        }
        else {
            habitats.push(null);
        }
    }
    return habitats;
}
