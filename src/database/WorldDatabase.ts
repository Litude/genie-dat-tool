import semver from "semver";
import BufferReader from "../BufferReader";
import { Border, readBordersFromDatFile, readAndVerifyBorderCountFromDatFile, writeBordersToJsonFiles, writeBordersToWorldTextFile, readBorderIdsFromJsonIndex, readBordersFromJsonFiles } from "./landscape/Border";
import { Colormap, readColormapIdsFromJsonIndex, readColormapsFromDatFile, readColormapsFromJsonFiles, writeColormapsToJsonFiles, writeColormapsToWorldTextFile } from "./Colormap";
import { Habitat, readHabitatIdsFromJsonIndex, readHabitatNamesFromJsonFile, readHabitatsFromDatFile, readHabitatsFromJsonFiles, writeHabitatsToJsonFiles, writeHabitatsToWorldTextFile } from "./landscape/Habitat";
import { JsonLoadingContext, LoadingContext } from "./LoadingContext";
import { MapProperties, writeMapPropertiesToJsonFile } from "./landscape/MapProperties";
import { RandomMap, readRandomMapData, writeRandomMapsToJsonFiles, writeRandomMapsToWorldTextFile } from "./landscape/RandomMap";
import { readSoundEffectIdsFromJsonIndex, readSoundEffectsFromDatFile, readSoundEffectsFromJsonFiles, SoundEffect, writeSoundEffectsToJsonFiles, writeSoundEffectsToWorldTextFile } from "./SoundEffect";
import { readSpriteIdsFromJsonIndex, readSpritesFromDatFile, readSpritesFromJsonFiles, Sprite, writeSpritesToJsonFiles, writeSpritesToWorldTextFile } from "./Sprite";
import { readAndVerifyTerrainCountFromDatFile, readTerrainIdsFromJsonIndex, readTerrainsFromDatFile, readTerrainsFromJsonFiles, Terrain, writeTerrainsToJsonFiles, writeTerrainsToWorldTextFile } from "./landscape/Terrain";
import { createFallbackStateEffectReferenceIdsIfNeeded, readStateEffectIdsFromJsonIndex, readStateEffects, readStateEffectsFromJsonFiles, StateEffect, writeStateEffectsToJsonFiles, writeStateEffectsToWorldTextFile } from "./research/StateEffect";
import { Civilization, readCivilizationIdsFromJsonIndex, readCivilizationsFromJsonFiles, writeCivilizationsToJsonFiles, writeCivilizationsToWorldTextFile } from "./Civilization";
import { BaseObjectPrototype, createBaselineObjectPrototypes, readObjectPrototypeIdsFromJsonIndex, readObjectPrototypesFromBuffer, readObjectPrototypesFromJsonFiles, writeObjectPrototypesToJsonFiles, writeObjectPrototypesToWorldTextFile } from "./object/ObjectPrototypes";
import { readTechnologiesFromBuffer, readTechnologiesFromJsonFiles, readTechnologyIdsFromJsonIndex, Technology, writeTechnologiesToJsonFiles, writeTechnologiesToWorldTextFile } from "./research/Technology";
import { SavingContext } from "./SavingContext";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";
import { Attribute, readAttributesFromJsonFile } from "./Attributes";
import { Overlay, readOverlaysFromDatFile, readAndVerifyOverlayCountFromDatFile, writeOverlaysToJsonFiles, writeOverlaysToWorldTextFile, readOverlayIdsFromJsonIndex, readOverlaysFromJsonFiles } from "./landscape/Overlay";
import { readTribeRandomMapData, TribeRandomMap, writeTribeRandomMapsToJsonFiles, writeTribeRandomMapsToWorldTextFile } from "./landscape/TribeRandomMap";
import { readTribeAiFromBuffer, TribeAi, writeTribeAiToJsonFiles, writeTribeAiToWorldTextFile } from "./TribeAi";
import { onParsingError, ParsingError } from "./Error";
import path from "path";
import { isDefined, Nullable } from "../ts/ts-utils";
import { ensureReferenceIdUniqueness } from "../json/reference-id";
import { clearDirectory } from "../files/file-utils";
import { asInt16 } from "../ts/base-types";
import { PathLike } from "fs";
import { createMappingFromJsonFileIndex } from "../json/json-serialization";
import { Logger } from "../Logger";

export class WorldDatabase {
    attributes: Attribute[] = [];
    habitats: Nullable<Habitat>[] = [];
    colormaps: Colormap[] = [];
    soundEffects: SoundEffect[] = [];
    sprites: Nullable<Sprite>[] = [];
    mapProperties: MapProperties = new MapProperties();
    terrains: Nullable<Terrain>[] = [];
    overlays: Nullable<Overlay>[] = [];
    borders: Nullable<Border>[] = [];
    tribeRandomMaps: TribeRandomMap[] = [];
    randomMaps: RandomMap[] = [];
    stateEffects: Nullable<StateEffect>[] = [];
    civilizations: Civilization[] = [];
    objects: Nullable<BaseObjectPrototype>[][] = [];
    baselineObjects: Nullable<BaseObjectPrototype>[] = [];
    technologies: Nullable<Technology>[] = [];
    tribeAi:  Nullable<TribeAi>[] = [];

    readFromBuffer(buffer: BufferReader, { habitatsFile, attributesFile} : { habitatsFile: string, attributesFile: string}, loadingContext: LoadingContext) {
        try {

            this.attributes = readAttributesFromJsonFile(attributesFile);
            const habitatNames = readHabitatNamesFromJsonFile(habitatsFile);

            this.habitats = readHabitatsFromDatFile(buffer, habitatNames, loadingContext);

            this.colormaps = readColormapsFromDatFile(buffer, loadingContext);

            this.soundEffects = readSoundEffectsFromDatFile(buffer, loadingContext);

            this.sprites = readSpritesFromDatFile(buffer, this.soundEffects, loadingContext);
    
            this.mapProperties = new MapProperties();
            this.mapProperties.readMainDataFromBuffer(buffer, loadingContext);

            this.terrains = readTerrainsFromDatFile(buffer, this.soundEffects, loadingContext);

            this.overlays = readOverlaysFromDatFile(buffer, this.soundEffects, loadingContext);
            
            this.borders = readBordersFromDatFile(buffer, this.soundEffects, this.terrains, loadingContext);
    
            this.mapProperties.readSecondaryDataFromBuffer(buffer, loadingContext);
            readAndVerifyTerrainCountFromDatFile(this.terrains, buffer, loadingContext);
            readAndVerifyOverlayCountFromDatFile(this.overlays, buffer, loadingContext);
            readAndVerifyBorderCountFromDatFile(this.borders, buffer, loadingContext);
    
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
            this.baselineObjects = createBaselineObjectPrototypes(this.objects);
    
            this.technologies = readTechnologiesFromBuffer(buffer, loadingContext);
            this.tribeAi = readTribeAiFromBuffer(buffer, loadingContext);
            
            ensureReferenceIdUniqueness(this.habitats);
            ensureReferenceIdUniqueness(this.colormaps);
            ensureReferenceIdUniqueness(this.soundEffects);
            ensureReferenceIdUniqueness(this.sprites);
            ensureReferenceIdUniqueness(this.terrains);
            ensureReferenceIdUniqueness(this.overlays);
            ensureReferenceIdUniqueness(this.borders);

            ensureReferenceIdUniqueness(this.baselineObjects);

            ensureReferenceIdUniqueness(this.technologies);

            // TODO: The hardcoded ids are not always the same...
            createFallbackStateEffectReferenceIdsIfNeeded(this.stateEffects, this.technologies, this.civilizations, {
                104: "Triple Hitpoints"
            });

            ensureReferenceIdUniqueness(this.stateEffects);

            this.sprites.forEach(sprite => sprite?.linkOtherData(this.sprites, loadingContext));
            this.habitats.forEach(habitat => habitat?.linkTerrains(this.terrains, loadingContext));
            this.terrains.forEach(terrain => terrain?.linkOtherData(this.terrains, this.borders, this.objects[0], loadingContext));
            this.tribeRandomMaps.forEach(tribeMap => tribeMap.linkOtherData(this.baselineObjects, loadingContext));
            this.randomMaps.forEach(randomMap => randomMap.linkOtherData(this.baselineObjects, loadingContext));
            this.technologies.forEach(technology => technology?.linkOtherData(this.technologies, this.baselineObjects, this.stateEffects, loadingContext));
            this.baselineObjects.forEach(object => object?.linkOtherData(
                this.sprites, this.soundEffects, this.terrains, this.habitats, this.baselineObjects, this.technologies, this.overlays, loadingContext
            ));
            this.civilizations.forEach(civilization => civilization.linkOtherData(this.stateEffects, loadingContext));
            this.objects.forEach(civObjects => civObjects.forEach((object) => object?.linkOtherData(
                this.sprites, this.soundEffects, this.terrains, this.habitats, this.baselineObjects, this.technologies, this.overlays, loadingContext
            )));
            this.tribeAi.forEach(tribeAi => tribeAi?.linkOtherData(this.baselineObjects, loadingContext));
    
            if (buffer.endOfBuffer()) {
                return true;
            }
            else {
                onParsingError(`Buffer still has unparsed data! Offset is ${buffer.tell()} and size is ${buffer.size()}`, loadingContext);
                return false;
            }
        } catch (err: unknown) {
            if (err instanceof ParsingError && loadingContext.abortOnError === true) {
                return false;
            }
            else {
                throw err;
            }
        }
    }

    readFromJsonFiles(directory: string) {
        // TODO: Do we need some kind of version file...?
        // Should all index files be processed first?
        const terrainIds = readTerrainIdsFromJsonIndex(directory);
        const overlayIds = readOverlayIdsFromJsonIndex(directory);
        const borderIds = readBorderIdsFromJsonIndex(directory);
        const terrainCount = terrainIds.filter(isDefined).length;
        const habitatIds = readHabitatIdsFromJsonIndex(directory);
        const spriteIds = readSpriteIdsFromJsonIndex(directory);
        const soundEffectIds = readSoundEffectIdsFromJsonIndex(directory);
        const stateEffectIds = readStateEffectIdsFromJsonIndex(directory);
        const civilizationIds = readCivilizationIdsFromJsonIndex(directory);
        const prototypeIds = readObjectPrototypeIdsFromJsonIndex(directory);
        const technologyIds = readTechnologyIdsFromJsonIndex(directory);

        const loadingContext: JsonLoadingContext = {
            version: {
                numbering: "2.7.0",
            },
            abortOnError: true,
            cleanedData: false,
            terrainCount,
            maxTerrainCount: 32, // TODO: Based on version...
            dataIds: {
                terrainIds: createMappingFromJsonFileIndex(terrainIds),
                overlayIds: createMappingFromJsonFileIndex(overlayIds),
                borderIds: createMappingFromJsonFileIndex(borderIds),
                habitatIds: createMappingFromJsonFileIndex(habitatIds),
                spriteIds: createMappingFromJsonFileIndex(spriteIds),
                soundEffectIds: createMappingFromJsonFileIndex(soundEffectIds),
                stateEffectIds: createMappingFromJsonFileIndex(stateEffectIds),
                prototypeIds: createMappingFromJsonFileIndex(prototypeIds),
                technologyIds: createMappingFromJsonFileIndex(technologyIds),
            }
        }
        this.habitats = readHabitatsFromJsonFiles(directory, terrainCount, habitatIds, loadingContext);

        const colormapIds = readColormapIdsFromJsonIndex(directory);
        this.colormaps = readColormapsFromJsonFiles(directory, colormapIds, loadingContext);
        this.soundEffects = readSoundEffectsFromJsonFiles(directory, soundEffectIds, loadingContext);
        this.sprites = readSpritesFromJsonFiles(directory, spriteIds, loadingContext);
        this.terrains = readTerrainsFromJsonFiles(directory, terrainIds, this.soundEffects, loadingContext);
        this.overlays = readOverlaysFromJsonFiles(directory, overlayIds, this.soundEffects, loadingContext);
        this.borders = readBordersFromJsonFiles(directory, borderIds, this.soundEffects, loadingContext);
        this.stateEffects = readStateEffectsFromJsonFiles(directory, stateEffectIds, loadingContext);
        this.civilizations = readCivilizationsFromJsonFiles(directory, civilizationIds, loadingContext);
        const civilizationCount = this.civilizations.length;
        this.objects = readObjectPrototypesFromJsonFiles(directory, prototypeIds, civilizationCount, loadingContext);
        this.baselineObjects = createBaselineObjectPrototypes(this.objects);
        this.technologies = readTechnologiesFromJsonFiles(directory, technologyIds, loadingContext);

        this.borders.forEach(border => border?.linkOtherData(this.terrains, loadingContext));

        console.log('JSON parsing finished');
    }

    writeToWorldTextFile(outputDirectory: string, savingContext: SavingContext) {
        writeHabitatsToWorldTextFile(outputDirectory, this.habitats, this.terrains.filter(x => x).length, savingContext);
        writeColormapsToWorldTextFile(outputDirectory, this.colormaps, savingContext);
        writeSoundEffectsToWorldTextFile(outputDirectory, this.soundEffects, savingContext);
        writeSpritesToWorldTextFile(outputDirectory, this.sprites, savingContext);
        writeTerrainsToWorldTextFile(outputDirectory, this.terrains, savingContext);
        writeOverlaysToWorldTextFile(outputDirectory, this.overlays, savingContext);
        writeBordersToWorldTextFile(outputDirectory, this.borders, savingContext);
        writeTribeRandomMapsToWorldTextFile(outputDirectory, this.tribeRandomMaps, savingContext);
        if (semver.gte(savingContext.version.numbering, "2.0.0")) {
            writeRandomMapsToWorldTextFile(outputDirectory, this.randomMaps, savingContext);
        }
        writeStateEffectsToWorldTextFile(outputDirectory, this.stateEffects, savingContext);
        writeCivilizationsToWorldTextFile(outputDirectory, this.civilizations, this.attributes, savingContext);
        writeObjectPrototypesToWorldTextFile(outputDirectory, this.civilizations, this.objects, savingContext);
        writeTechnologiesToWorldTextFile(outputDirectory, this.technologies, savingContext);
        if (semver.lt(savingContext.version.numbering, "2.0.0")) {
            writeTribeAiToWorldTextFile(outputDirectory, this.tribeAi, savingContext);
        }

        const textFileWriter = new TextFileWriter(path.join(outputDirectory, TextFileNames.MainFile));
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
            .string(TextFileNames.ObjectPrototypes, 13).eol()
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

    writeToJsonFile(outputDirectory: string, savingContext: SavingContext) {
        clearDirectory(outputDirectory);
        writeHabitatsToJsonFiles(outputDirectory, this.habitats, savingContext);
        writeColormapsToJsonFiles(outputDirectory, this.colormaps, savingContext);
        writeSoundEffectsToJsonFiles(outputDirectory, this.soundEffects, savingContext);
        writeSpritesToJsonFiles(outputDirectory, this.sprites, savingContext);
        writeTerrainsToJsonFiles(outputDirectory, this.terrains, savingContext);
        writeOverlaysToJsonFiles(outputDirectory, this.overlays, savingContext);
        writeBordersToJsonFiles(outputDirectory, this.borders, savingContext);
        writeMapPropertiesToJsonFile(outputDirectory, this.mapProperties, savingContext);
        writeTribeRandomMapsToJsonFiles(outputDirectory, this.tribeRandomMaps, savingContext);
        writeRandomMapsToJsonFiles(outputDirectory, this.randomMaps, savingContext);
        writeStateEffectsToJsonFiles(outputDirectory, this.stateEffects, savingContext);
        writeCivilizationsToJsonFiles(outputDirectory, this.civilizations, savingContext);
        writeObjectPrototypesToJsonFiles(outputDirectory, this.baselineObjects, this.objects, savingContext);
        writeTechnologiesToJsonFiles(outputDirectory, this.technologies, savingContext);
        writeTribeAiToJsonFiles(outputDirectory, this.tribeAi, savingContext);

        Logger.info(`Finished writing JSON files`);
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
