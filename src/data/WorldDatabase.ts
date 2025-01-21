import BufferReader from "../BufferReader";
import { Border, readMainBorderData, readSecondaryBorderData } from "./landscape/Border";
import { Colormap, readColormaps } from "./Colormap";
import { Habitat, readHabitats } from "./landscape/Habitat";
import { LoadingContext } from "./LoadingContext";
import { MapProperties } from "./landscape/MapProperties";
import { RandomMap, readRandomMapData } from "./landscape/RandomMap";
import { readSoundEffects, SoundEffect } from "./SoundEffect";
import { readSprites, Sprite } from "./Sprite";
import { readMainTerrainData, readSecondaryTerrainData, Terrain } from "./landscape/Terrain";
import { readStateEffects, StateEffect } from "./research/StateEffect";
import { Civilization } from "./Civilization";
import { SceneryObjectPrototype } from "./object/SceneryObjectPrototype";
import { readObjectPrototypesFromBuffer } from "./object/ObjectPrototypes";
import { readTechnologiesFromBuffer, Technology } from "./research/Technology";

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

    constructor(buffer: BufferReader, loadingContent: LoadingContext) {
        this.habitats = readHabitats(buffer, loadingContent);
        this.colormaps = readColormaps(buffer, loadingContent);
        this.soundEffects = readSoundEffects(buffer, loadingContent);
        this.sprites = readSprites(buffer, loadingContent);

        this.mapProperties = new MapProperties();
        this.mapProperties.readMainDataFromBuffer(buffer, loadingContent);
        this.terrains = readMainTerrainData(buffer, loadingContent);
        // todo: overlays are here
        this.borders = readMainBorderData(buffer, loadingContent);

        this.mapProperties.readSecondaryDataFromBuffer(buffer, loadingContent);
        readSecondaryTerrainData(this.terrains, buffer, loadingContent);
        // todo: overlays are here
        readSecondaryBorderData(this.borders, buffer, loadingContent);

        this.mapProperties.readTertiaryDataFromBuffer(buffer, loadingContent);

        const randomMapCount = buffer.readInt32();
        this.mapProperties.readQuaterniaryDataFromBuffer(buffer, loadingContent);
        // TODO: tribe random maps are here
        this.randomMaps = readRandomMapData(randomMapCount, buffer, loadingContent);

        this.stateEffects = readStateEffects(buffer, loadingContent);

        const civilizationCount = buffer.readInt16();
        this.civilizations = [];
        this.objects = [];
        for (let i = 0; i < civilizationCount; ++i) {
            const civilization = new Civilization();
            civilization.readFromBuffer(buffer, loadingContent);
            this.civilizations.push(civilization);
            this.objects.push(readObjectPrototypesFromBuffer(buffer, loadingContent));
        }

        this.technologies = readTechnologiesFromBuffer(buffer, loadingContent);
        // TODO: tribe AI is here

        if (buffer.endOfBuffer()) {
            console.log(`Buffer completely parsed!`)
        }
        else {
            console.log(`Buffer offset is ${buffer.tell()} and size is ${buffer.size()}`)
        }
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
