import BufferReader from "../BufferReader";
import { Border, readMainBorderData, readSecondaryBorderData } from "./landscape/Border";
import { Colormap, readColormaps, writeColormapsToWorldTextFile } from "./Colormap";
import { Habitat, readHabitats, writeHabitatsToWorldTextFile } from "./landscape/Habitat";
import { LoadingContext } from "./LoadingContext";
import { MapProperties } from "./landscape/MapProperties";
import { RandomMap, readRandomMapData } from "./landscape/RandomMap";
import { readSoundEffects, SoundEffect, writeSoundEffectsToWorldTextFile } from "./SoundEffect";
import { readSprites, Sprite } from "./Sprite";
import { readMainTerrainData, readSecondaryTerrainData, Terrain } from "./landscape/Terrain";
import { readStateEffects, StateEffect } from "./research/StateEffect";
import { Civilization } from "./Civilization";
import { SceneryObjectPrototype } from "./object/SceneryObjectPrototype";
import { readObjectPrototypesFromBuffer } from "./object/ObjectPrototypes";
import { readTechnologiesFromBuffer, Technology } from "./research/Technology";
import { createWriteStream } from "fs";
import { EOL } from "node:os";
import { SavingContext } from "./SavingContext";

export class WorldDatabase {
    habitats: (Habitat | null)[];
    colormaps: Colormap[];
    soundEffects: SoundEffect[];
    sprites: (Sprite | null)[];
    mapProperties: MapProperties;
    terrains: Terrain[];
    borders: Border[];
    randomMaps: RandomMap[];
    stateEffects: StateEffect[];
    civilizations: Civilization[];
    objects: (SceneryObjectPrototype | null)[][];
    technologies: Technology[];

    constructor(buffer: BufferReader, loadingContext: LoadingContext) {
        this.habitats = readHabitats(buffer, loadingContext);
        this.colormaps = readColormaps(buffer, loadingContext);
        this.soundEffects = readSoundEffects(buffer, loadingContext);
        this.sprites = readSprites(buffer, loadingContext);

        this.mapProperties = new MapProperties();
        this.mapProperties.readMainDataFromBuffer(buffer, loadingContext);
        this.terrains = readMainTerrainData(buffer, loadingContext);
        // todo: overlays are here
        this.borders = readMainBorderData(buffer, loadingContext);

        this.mapProperties.readSecondaryDataFromBuffer(buffer, loadingContext);
        readSecondaryTerrainData(this.terrains, buffer, loadingContext);
        // todo: overlays are here
        readSecondaryBorderData(this.borders, buffer, loadingContext);

        this.mapProperties.readTertiaryDataFromBuffer(buffer, loadingContext);

        const randomMapCount = buffer.readInt32();
        this.mapProperties.readQuaterniaryDataFromBuffer(buffer, loadingContext);
        // TODO: tribe random maps are here
        this.randomMaps = readRandomMapData(randomMapCount, buffer, loadingContext);

        this.stateEffects = readStateEffects(buffer, loadingContext);

        const civilizationCount = buffer.readInt16();
        this.civilizations = [];
        this.objects = [];
        for (let i = 0; i < civilizationCount; ++i) {
            const civilization = new Civilization();
            civilization.readFromBuffer(buffer, loadingContext);
            this.civilizations.push(civilization);
            this.objects.push(readObjectPrototypesFromBuffer(buffer, loadingContext));
        }

        this.technologies = readTechnologiesFromBuffer(buffer, loadingContext);
        // TODO: tribe AI is here

        if (buffer.endOfBuffer()) {
            console.log(`Buffer completely parsed!`)
        }
        else {
            console.log(`Buffer offset is ${buffer.tell()} and size is ${buffer.size()}`)
        }

        this.habitats.forEach(habitat => habitat?.linkTerrains(this.terrains));
    }

    writeToWorldTextFile() {
        const savingContext: SavingContext = { version: 3.7 };
        writeHabitatsToWorldTextFile(this.habitats, this.terrains.length, savingContext);
        writeColormapsToWorldTextFile(this.colormaps, savingContext);
        writeSoundEffectsToWorldTextFile(this.soundEffects, savingContext);
    }

    toString() {
        let result = ''
        // result += `Habitats (${this.habitats.length}):\n${this.habitats.join('\n')}\n`;
        // result += `Colormaps (${this.colormaps.length}):\n${this.colormaps.join('\n')}\n`;
        // result += `Sound Effects (${this.soundEffects.length}):\n${this.soundEffects.join('\n')}\n`;
        // result += `Sprites (${this.sprites.length}):\n${this.sprites.join('\n')}\n`;
        result += `Map Properties:\n${this.mapProperties}\n`;
        //result += `Terrains (${this.terrains.length}):\n${this.terrains.join('\n')}\n`;
        //result += `Terrains (${this.terrains.length}):\n\n`;
        //result += `Borders (${this.borders.length}):\n${this.borders.join('\n')}\n`;
        result += `Random Maps (${this.randomMaps.length}):\n${this.randomMaps.join('\n')}\n`;
        result += `State Effects (${this.stateEffects.length}):\n${this.stateEffects.join('\n')}\n`;
        result += `Technologies (${this.technologies.length}):\n${this.technologies.join('\n')}\n`;
        return result;
    }
}
