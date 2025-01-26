import semver from "semver";
import BufferReader from "../BufferReader";
import { Border, readMainBorderData, readSecondaryBorderData, writeBordersToWorldTextFile } from "./landscape/Border";
import { Colormap, readColormaps, writeColormapsToWorldTextFile } from "./Colormap";
import { Habitat, readHabitats, writeHabitatsToWorldTextFile } from "./landscape/Habitat";
import { LoadingContext } from "./LoadingContext";
import { MapProperties } from "./landscape/MapProperties";
import { RandomMap, readRandomMapData, writeRandomMapsToWorldTextFile } from "./landscape/RandomMap";
import { readSoundEffects, SoundEffect, writeSoundEffectsToWorldTextFile } from "./SoundEffect";
import { readSprites, Sprite, writeSpritesToWorldTextFile } from "./Sprite";
import { readMainTerrainData, readSecondaryTerrainData, Terrain, writeTerrainsToWorldTextFile } from "./landscape/Terrain";
import { readStateEffects, StateEffect, writeStateEffectsToWorldTextFile } from "./research/StateEffect";
import { Civilization, writeCivilizationsToWorldTextFile } from "./Civilization";
import { SceneryObjectPrototype } from "./object/SceneryObjectPrototype";
import { readObjectPrototypesFromBuffer, writObjectPrototypesToWorldTextFile } from "./object/ObjectPrototypes";
import { readTechnologiesFromBuffer, Technology, writeTechnologiesToWorldTextFile } from "./research/Technology";
import { SavingContext } from "./SavingContext";
import { asInt16 } from "./Types";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";
import { Attribute, readAttributesFromJsonFile } from "./Attributes";
import { Overlay, readMainOverlayData, readSecondaryOverlayData, writeOverlaysToWorldTextFile } from "./landscape/Overlay";
import { readTribeRandomMapData, TribeRandomMap, writeTribeRandomMapsToWorldTextFile } from "./landscape/TribeRandomMap";
import { readTribeAiFromBuffer, TribeAi, writeTribeAiToWorldTextFile } from "./TribeAi";

export class WorldDatabase {
    attributes: Attribute[];
    habitats: (Habitat | null)[];
    colormaps: Colormap[];
    soundEffects: SoundEffect[];
    sprites: (Sprite | null)[];
    mapProperties: MapProperties;
    terrains: (Terrain | null)[];
    overlays: (Overlay | null)[];
    borders: (Border | null)[];
    tribeRandomMaps: TribeRandomMap[];
    randomMaps: RandomMap[];
    stateEffects: StateEffect[];
    civilizations: Civilization[];
    objects: (SceneryObjectPrototype | null)[][];
    technologies: Technology[];
    tribeAi: (TribeAi | null)[];

    constructor(buffer: BufferReader, loadingContext: LoadingContext) {
        this.attributes = readAttributesFromJsonFile("./data/attributes.json");
        this.habitats = readHabitats(buffer, loadingContext);
        this.colormaps = readColormaps(buffer, loadingContext);
        this.soundEffects = readSoundEffects(buffer, loadingContext);
        this.sprites = readSprites(buffer, this.soundEffects, loadingContext);

        this.mapProperties = new MapProperties();
        this.mapProperties.readMainDataFromBuffer(buffer, loadingContext);
        this.terrains = readMainTerrainData(buffer, this.soundEffects, loadingContext);
        this.overlays = readMainOverlayData(buffer, this.soundEffects, loadingContext);
        this.borders = readMainBorderData(buffer, this.soundEffects, this.terrains, loadingContext);

        this.mapProperties.readSecondaryDataFromBuffer(buffer, loadingContext);
        readSecondaryTerrainData(this.terrains, buffer, loadingContext);
        readSecondaryOverlayData(this.overlays, buffer, loadingContext);
        readSecondaryBorderData(this.borders, buffer, loadingContext);

        this.mapProperties.readTertiaryDataFromBuffer(buffer, loadingContext);

        const randomMapCount = buffer.readInt32();
        this.mapProperties.readQuaterniaryDataFromBuffer(buffer, loadingContext);
        this.tribeRandomMaps = readTribeRandomMapData(randomMapCount, buffer, this.terrains, this.borders, loadingContext);
        this.randomMaps = readRandomMapData(randomMapCount, buffer, this.terrains, loadingContext);

        this.stateEffects = readStateEffects(buffer, loadingContext);

        const civilizationCount = buffer.readInt16();
        this.civilizations = [];
        this.objects = [];
        for (let i = 0; i < civilizationCount; ++i) {
            const civilization = new Civilization();
            civilization.readFromBuffer(buffer, asInt16(i), loadingContext);
            this.civilizations.push(civilization);
            this.objects.push(readObjectPrototypesFromBuffer(buffer, loadingContext));
        }

        this.technologies = readTechnologiesFromBuffer(buffer, loadingContext);
        this.tribeAi = readTribeAiFromBuffer(buffer, loadingContext);

        if (buffer.endOfBuffer()) {
            console.log(`Buffer completely parsed!`)
        }
        else {
            console.log(`Buffer offset is ${buffer.tell()} and size is ${buffer.size()}`)
        }

        this.habitats.forEach(habitat => habitat?.linkTerrains(this.terrains));
        this.terrains.forEach(terrain => terrain?.linkOtherData(this.terrains, this.borders, this.objects[0]));
        // TODO: What if gaia is missing stuff...? This should really link with a merged base object or something?
        this.randomMaps.forEach(randomMap => randomMap.linkOtherData(this.objects[0]))
    }

    writeToWorldTextFile(savingContext: SavingContext) {
        writeHabitatsToWorldTextFile(this.habitats, this.terrains.filter(x => x).length, savingContext);
        writeColormapsToWorldTextFile(this.colormaps, savingContext);
        writeSoundEffectsToWorldTextFile(this.soundEffects, savingContext);
        writeSpritesToWorldTextFile(this.sprites, savingContext);
        writeTerrainsToWorldTextFile(this.terrains, savingContext);
        writeOverlaysToWorldTextFile(this.overlays, savingContext);
        writeBordersToWorldTextFile(this.borders, savingContext);
        writeTribeRandomMapsToWorldTextFile(this.tribeRandomMaps, savingContext);
        if (semver.gte(savingContext.version.numbering, "2.0.0")) {
            writeRandomMapsToWorldTextFile(this.randomMaps, savingContext);
        }
        writeStateEffectsToWorldTextFile(this.stateEffects, savingContext);
        writeCivilizationsToWorldTextFile(this.civilizations, this.attributes, savingContext);
        writObjectPrototypesToWorldTextFile(this.civilizations, this.objects, savingContext);
        writeTechnologiesToWorldTextFile(this.technologies, savingContext);
        writeTribeAiToWorldTextFile(this.tribeAi, savingContext);

        const textFileWriter = new TextFileWriter(TextFileNames.MainFile);
        textFileWriter
            .string(TextFileNames.Habitats, 13).eol()
            .string(TextFileNames.Colormaps, 13).eol()
            .string(TextFileNames.SoundEffects, 13).eol()
            .string(TextFileNames.Borders, 13).eol()
            .string(TextFileNames.Overlays, 13).eol()
            .string(TextFileNames.Terrains, 13).eol()
            .string(TextFileNames.TribeRandomMaps, 13).eol()
            .string(TextFileNames.Sprites, 13).eol()
            .string(TextFileNames.Civilizations, 13).eol()
            .string(TextFileNames.Objects, 13).eol()
            .string(TextFileNames.StateEffects, 13).eol()
            .string(TextFileNames.TerrainObjects, 13).eol()

        if (semver.gte(savingContext.version.numbering, "2.0.0")) {
            textFileWriter
                .string(TextFileNames.RandomMapDefinitons, 13).eol()
                .string(TextFileNames.RandomMapBaseLands, 13).eol()
                .string(TextFileNames.RandomMapTerrains, 13).eol()
                .string(TextFileNames.RandomMapObjects, 13).eol()
        }

        textFileWriter
            .integer(this.mapProperties.tileWidthPx).eol()
            .integer(this.mapProperties.tileHeightPx).eol()
            .integer(this.mapProperties.elevationHeightPx).eol()
            .raw(TextFileNames.Technologies).eol();

        if (semver.lt(savingContext.version.numbering, "2.0.0")) {
            textFileWriter
                .raw(TextFileNames.TribeAi).eol();
        }

        textFileWriter.close();

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
