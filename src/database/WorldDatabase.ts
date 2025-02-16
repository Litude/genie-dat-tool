import semver from "semver";
import BufferReader from "../BufferReader";
import {
  Border,
  readBordersFromDatFile,
  readAndVerifyBorderCountFromDatFile,
  writeBordersToJsonFiles,
  writeBordersToWorldTextFile,
  readBorderIdsFromJsonIndex,
  readBordersFromJsonFiles,
  writeBordersResourceList,
} from "./landscape/Border";
import {
  Colormap,
  readColormapIdsFromJsonIndex,
  readColormapsFromDatFile,
  readColormapsFromJsonFiles,
  writeColormapsToJsonFiles,
  writeColormapsToWorldTextFile,
} from "./Colormap";
import {
  Habitat,
  readHabitatIdsFromJsonIndex,
  readHabitatNamesFromJsonFile,
  readHabitatsFromDatFile,
  readHabitatsFromJsonFiles,
  writeHabitatsToJsonFiles,
  writeHabitatsToWorldTextFile,
} from "./landscape/Habitat";
import {
  DatLoadingContext,
  JsonLoadingContext,
  LoadingContext,
} from "./LoadingContext";
import {
  MapProperties,
  writeMapPropertiesToJsonFile,
} from "./landscape/MapProperties";
import {
  RandomMap,
  readRandomMapIdsFromJsonIndex,
  readRandomMapsFromBuffer,
  readRandomMapsFromJsonFiles,
  writeRandomMapsToJsonFiles,
  writeRandomMapsToWorldTextFile,
} from "./landscape/RandomMap";
import {
  readSoundEffectIdsFromJsonIndex,
  readSoundEffectsFromDatFile,
  readSoundEffectsFromJsonFiles,
  SoundEffect,
  writeSoundEffectsResourceList,
  writeSoundEffectsToJsonFiles,
  writeSoundEffectsToWorldTextFile,
} from "./SoundEffect";
import {
  readSpriteIdsFromJsonIndex,
  readSpritesFromDatFile,
  readSpritesFromJsonFiles,
  Sprite,
  writeSpriteResourceList,
  writeSpritesToJsonFiles,
  writeSpritesToWorldTextFile,
} from "./Sprite";
import {
  readAndVerifyTerrainCountFromDatFile,
  readTerrainIdsFromJsonIndex,
  readTerrainsFromDatFile,
  readTerrainsFromJsonFiles,
  Terrain,
  writeTerrainsResourceList,
  writeTerrainsToJsonFiles,
  writeTerrainsToWorldTextFile,
} from "./landscape/Terrain";
import {
  createFallbackStateEffectReferenceIdsIfNeeded,
  readStateEffectIdsFromJsonIndex,
  readStateEffectNamesFromJsonFile,
  readStateEffectsFromBuffer,
  readStateEffectsFromJsonFiles,
  StateEffect,
  writeStateEffectsToJsonFiles,
  writeStateEffectsToWorldTextFile,
} from "./research/StateEffect";
import {
  Civilization,
  readCivilizationIdsFromJsonIndex,
  readCivilizationsFromJsonFiles,
  writeCivilizationsToJsonFiles,
  writeCivilizationsToWorldTextFile,
} from "./Civilization";
import {
  BaseObjectPrototype,
  createBaselineObjectPrototypes,
  readObjectPrototypeIdsFromJsonIndex,
  readObjectPrototypesFromBuffer,
  readObjectPrototypesFromJsonFiles,
  writeObjectPrototypesToJsonFiles,
  writeObjectPrototypesToWorldTextFile,
} from "./object/ObjectPrototypes";
import {
  readTechnologiesFromBuffer,
  readTechnologiesFromJsonFiles,
  readTechnologyIdsFromJsonIndex,
  Technology,
  writeTechnologiesToJsonFiles,
  writeTechnologiesToWorldTextFile,
} from "./research/Technology";
import { SavingContext } from "./SavingContext";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { TextFileNames } from "../textfile/TextFile";
import { Attribute, readAttributesFromJsonFile } from "./Attributes";
import {
  Overlay,
  readOverlaysFromDatFile,
  readAndVerifyOverlayCountFromDatFile,
  writeOverlaysToJsonFiles,
  writeOverlaysToWorldTextFile,
  readOverlayIdsFromJsonIndex,
  readOverlaysFromJsonFiles,
  writeOverlaysResourceList,
} from "./landscape/Overlay";
import {
  readTribeRandomMapIdsFromJsonIndex,
  readTribeRandomMapsFromBuffer,
  readTribeRandomMapsFromJsonFiles,
  TribeRandomMap,
  writeTribeRandomMapsToJsonFiles,
  writeTribeRandomMapsToWorldTextFile,
} from "./landscape/TribeRandomMap";
import {
  readTribeAiIdsFromJsonIndex,
  readTribeAisFromBuffer,
  readTribeAisFromJsonFiles,
  TribeAi,
  writeTribeAisToJsonFiles,
  writeTribeAisToWorldTextFile,
} from "./TribeAi";
import { onParsingError, ParsingError } from "./Error";
import path from "path";
import { isDefined, Nullable } from "../ts/ts-utils";
import { ensureReferenceIdUniqueness } from "../json/reference-id";
import { clearDirectory } from "../files/file-utils";
import { asInt16 } from "../ts/base-types";
import {
  createJson,
  createMappingFromJsonFileIndex,
} from "../json/json-serialization";
import { Logger } from "../Logger";
import { writeFileSync } from "fs";

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
  tribeAi: Nullable<TribeAi>[] = [];

  readFromBuffer(
    buffer: BufferReader,
    {
      habitatsFile,
      attributesFile,
      effectNames,
    }: { habitatsFile: string; attributesFile: string; effectNames?: string },
    loadingContext: DatLoadingContext,
  ) {
    try {
      this.attributes = readAttributesFromJsonFile(attributesFile);
      const habitatNames = readHabitatNamesFromJsonFile(habitatsFile);

      this.habitats = readHabitatsFromDatFile(
        buffer,
        habitatNames,
        loadingContext,
      );

      this.colormaps = readColormapsFromDatFile(buffer, loadingContext);

      this.soundEffects = readSoundEffectsFromDatFile(buffer, loadingContext);

      this.sprites = readSpritesFromDatFile(buffer, loadingContext);

      this.mapProperties = new MapProperties();
      this.mapProperties.readMainDataFromBuffer(buffer, loadingContext);

      this.terrains = readTerrainsFromDatFile(buffer, loadingContext);
      this.overlays = readOverlaysFromDatFile(buffer, loadingContext);
      this.borders = readBordersFromDatFile(buffer, loadingContext);

      this.mapProperties.readSecondaryDataFromBuffer(buffer, loadingContext);
      readAndVerifyTerrainCountFromDatFile(
        this.terrains,
        buffer,
        loadingContext,
      );
      readAndVerifyOverlayCountFromDatFile(
        this.overlays,
        buffer,
        loadingContext,
      );
      readAndVerifyBorderCountFromDatFile(this.borders, buffer, loadingContext);

      this.mapProperties.readTertiaryDataFromBuffer(buffer, loadingContext);

      const randomMapCount = buffer.readInt32();
      this.mapProperties.readQuaterniaryDataFromBuffer(buffer, loadingContext);
      this.tribeRandomMaps = readTribeRandomMapsFromBuffer(
        randomMapCount,
        buffer,
        loadingContext,
      );
      this.randomMaps = readRandomMapsFromBuffer(
        randomMapCount,
        buffer,
        loadingContext,
      );

      const stateEffectNames = effectNames
        ? readStateEffectNamesFromJsonFile(effectNames)
        : [];
      this.stateEffects = readStateEffectsFromBuffer(
        buffer,
        stateEffectNames,
        loadingContext,
      );

      const civilizationCount = buffer.readInt16();
      this.civilizations = [];
      this.objects = [];
      for (let i = 0; i < civilizationCount; ++i) {
        const civilization = new Civilization();
        civilization.readFromBuffer(buffer, asInt16(i), loadingContext);
        this.civilizations.push(civilization);
        this.objects.push(
          readObjectPrototypesFromBuffer(buffer, loadingContext),
        );
      }
      this.baselineObjects = createBaselineObjectPrototypes(this.objects);

      this.technologies = readTechnologiesFromBuffer(buffer, loadingContext);
      this.tribeAi = readTribeAisFromBuffer(buffer, loadingContext);

      this.fixReferenceIds(loadingContext);

      this.linkOtherData(loadingContext);

      if (buffer.endOfBuffer()) {
        return true;
      } else {
        onParsingError(
          `Buffer still has unparsed data! Offset is ${buffer.tell()} and size is ${buffer.size()}`,
          loadingContext,
        );
        return false;
      }
    } catch (err: unknown) {
      if (err instanceof ParsingError && loadingContext.abortOnError === true) {
        return false;
      } else {
        throw err;
      }
    }
  }

  readFromJsonFiles(
    directory: string,
    { attributesFile }: { attributesFile: string },
  ) {
    this.attributes = readAttributesFromJsonFile(attributesFile);

    const habitatIds = readHabitatIdsFromJsonIndex(directory);
    const colormapIds = readColormapIdsFromJsonIndex(directory);
    const spriteIds = readSpriteIdsFromJsonIndex(directory);
    const soundEffectIds = readSoundEffectIdsFromJsonIndex(directory);
    const terrainIds = readTerrainIdsFromJsonIndex(directory);
    const overlayIds = readOverlayIdsFromJsonIndex(directory);
    const borderIds = readBorderIdsFromJsonIndex(directory);
    const terrainCount = terrainIds.filter(isDefined).length;
    const tribeRandomMapIds = readTribeRandomMapIdsFromJsonIndex(directory);
    const randomMapIds = readRandomMapIdsFromJsonIndex(directory);
    const stateEffectIds = readStateEffectIdsFromJsonIndex(directory);
    const civilizationIds = readCivilizationIdsFromJsonIndex(directory);
    const prototypeIds = readObjectPrototypeIdsFromJsonIndex(directory);
    const technologyIds = readTechnologyIdsFromJsonIndex(directory);
    const tribeAiIds = readTribeAiIdsFromJsonIndex(directory);

    const loadingContext: JsonLoadingContext = {
      version: {
        numbering: "9.9.9", // Always read all fields from the JSON files and use version fallbacks. Only use written version as default output version.
      },
      abortOnError: true,
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
      },
    };
    this.habitats = readHabitatsFromJsonFiles(
      directory,
      habitatIds,
      loadingContext,
    );

    this.colormaps = readColormapsFromJsonFiles(
      directory,
      colormapIds,
      loadingContext,
    );
    this.soundEffects = readSoundEffectsFromJsonFiles(
      directory,
      soundEffectIds,
      loadingContext,
    );
    this.sprites = readSpritesFromJsonFiles(
      directory,
      spriteIds,
      loadingContext,
    );
    this.terrains = readTerrainsFromJsonFiles(
      directory,
      terrainIds,
      loadingContext,
    );
    this.overlays = readOverlaysFromJsonFiles(
      directory,
      overlayIds,
      loadingContext,
    );
    this.borders = readBordersFromJsonFiles(
      directory,
      borderIds,
      loadingContext,
    );

    this.mapProperties = MapProperties.readFromJsonFile(
      directory,
      loadingContext,
    );
    this.tribeRandomMaps = readTribeRandomMapsFromJsonFiles(
      directory,
      tribeRandomMapIds,
      loadingContext,
    );
    this.randomMaps = readRandomMapsFromJsonFiles(
      directory,
      randomMapIds,
      loadingContext,
    );

    this.stateEffects = readStateEffectsFromJsonFiles(
      directory,
      stateEffectIds,
      loadingContext,
    );
    this.civilizations = readCivilizationsFromJsonFiles(
      directory,
      civilizationIds,
      loadingContext,
    );
    const civilizationCount = this.civilizations.length;
    this.objects = readObjectPrototypesFromJsonFiles(
      directory,
      prototypeIds,
      civilizationCount,
      loadingContext,
    );
    this.baselineObjects = createBaselineObjectPrototypes(this.objects);
    this.technologies = readTechnologiesFromJsonFiles(
      directory,
      technologyIds,
      loadingContext,
    );
    this.tribeAi = readTribeAisFromJsonFiles(
      directory,
      tribeAiIds,
      loadingContext,
    );

    this.linkOtherData(loadingContext);
  }

  linkOtherData(loadingContext: LoadingContext) {
    this.sprites.forEach((sprite) =>
      sprite?.linkOtherData(this.sprites, this.soundEffects, loadingContext),
    );
    this.habitats.forEach((habitat) =>
      habitat?.linkTerrains(this.terrains, loadingContext),
    );
    this.terrains.forEach((terrain) =>
      terrain?.linkOtherData(
        this.terrains,
        this.borders,
        this.soundEffects,
        this.baselineObjects,
        loadingContext,
      ),
    );
    this.overlays.forEach((overlay) =>
      overlay?.linkOtherData(this.soundEffects, loadingContext),
    );
    this.borders.forEach((border) =>
      border?.linkOtherData(this.terrains, this.soundEffects, loadingContext),
    );

    this.tribeRandomMaps.forEach((tribeMap) =>
      tribeMap.linkOtherData(
        this.terrains,
        this.baselineObjects,
        loadingContext,
      ),
    );
    this.randomMaps.forEach((randomMap) =>
      randomMap.linkOtherData(
        this.terrains,
        this.baselineObjects,
        loadingContext,
      ),
    );

    this.civilizations.forEach((civilization) =>
      civilization.linkOtherData(this.stateEffects, loadingContext),
    );
    this.baselineObjects.forEach((object) =>
      object?.linkOtherData(
        this.sprites,
        this.soundEffects,
        this.terrains,
        this.habitats,
        this.baselineObjects,
        this.technologies,
        this.overlays,
        loadingContext,
      ),
    );
    this.objects.forEach((civObjects) =>
      civObjects.forEach((object) =>
        object?.linkOtherData(
          this.sprites,
          this.soundEffects,
          this.terrains,
          this.habitats,
          this.baselineObjects,
          this.technologies,
          this.overlays,
          loadingContext,
        ),
      ),
    );
    this.technologies.forEach((technology) =>
      technology?.linkOtherData(
        this.technologies,
        this.baselineObjects,
        this.stateEffects,
        loadingContext,
      ),
    );
    this.tribeAi.forEach((tribeAi) =>
      tribeAi?.linkOtherData(this.baselineObjects, loadingContext),
    );
  }

  fixReferenceIds(_loadingContext: LoadingContext) {
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
    createFallbackStateEffectReferenceIdsIfNeeded(
      this.stateEffects,
      this.technologies,
      this.civilizations,
      {
        104: "Triple Hitpoints",
      },
    );
    ensureReferenceIdUniqueness(this.stateEffects);
  }

  writeToWorldTextFile(outputDirectory: string, savingContext: SavingContext) {
    writeHabitatsToWorldTextFile(
      outputDirectory,
      this.habitats,
      this.terrains.filter((x) => x).length,
      savingContext,
    );
    writeColormapsToWorldTextFile(
      outputDirectory,
      this.colormaps,
      savingContext,
    );
    writeSoundEffectsToWorldTextFile(
      outputDirectory,
      this.soundEffects,
      savingContext,
    );
    writeSpritesToWorldTextFile(outputDirectory, this.sprites, savingContext);
    writeTerrainsToWorldTextFile(outputDirectory, this.terrains, savingContext);
    writeOverlaysToWorldTextFile(outputDirectory, this.overlays, savingContext);
    writeBordersToWorldTextFile(outputDirectory, this.borders, savingContext);
    writeTribeRandomMapsToWorldTextFile(
      outputDirectory,
      this.tribeRandomMaps,
      savingContext,
    );
    if (semver.gte(savingContext.version.numbering, "2.0.0")) {
      writeRandomMapsToWorldTextFile(
        outputDirectory,
        this.randomMaps,
        savingContext,
      );
    }
    writeStateEffectsToWorldTextFile(
      outputDirectory,
      this.stateEffects,
      savingContext,
    );
    writeCivilizationsToWorldTextFile(
      outputDirectory,
      this.civilizations,
      this.attributes,
      savingContext,
    );
    writeObjectPrototypesToWorldTextFile(
      outputDirectory,
      this.civilizations,
      this.objects,
      savingContext,
    );
    writeTechnologiesToWorldTextFile(
      outputDirectory,
      this.technologies,
      savingContext,
    );
    if (semver.lt(savingContext.version.numbering, "2.0.0")) {
      writeTribeAisToWorldTextFile(
        outputDirectory,
        this.tribeAi,
        savingContext,
      );
    }

    const textFileWriter = new TextFileWriter(
      path.join(outputDirectory, TextFileNames.MainFile),
    );
    textFileWriter
      .string(TextFileNames.Habitats, 13)
      .eol()
      .string(TextFileNames.Colormaps, 13)
      .eol()
      .string(TextFileNames.SoundEffects, 13)
      .eol()
      .string(TextFileNames.Borders, 13)
      .eol()
      .string(TextFileNames.Overlays, 13)
      .eol()
      .string(TextFileNames.Terrains, 13)
      .eol()
      .string(TextFileNames.TribeRandomMaps, 13)
      .eol()
      .string(TextFileNames.Sprites, 13)
      .eol()
      .string(TextFileNames.Civilizations, 13)
      .eol()
      .string(TextFileNames.ObjectPrototypes, 13)
      .eol()
      .string(TextFileNames.StateEffects, 13)
      .eol()
      .string(TextFileNames.TerrainObjects, 13)
      .eol();

    if (semver.gte(savingContext.version.numbering, "2.0.0")) {
      textFileWriter
        .string(TextFileNames.RandomMapDefinitons, 13)
        .eol()
        .string(TextFileNames.RandomMapBaseLands, 13)
        .eol()
        .string(TextFileNames.RandomMapTerrains, 13)
        .eol()
        .string(TextFileNames.RandomMapObjects, 13)
        .eol();
    }

    textFileWriter
      .integer(this.mapProperties.tileWidthPx)
      .eol()
      .integer(this.mapProperties.tileHeightPx)
      .eol()
      .integer(this.mapProperties.elevationHeightPx)
      .eol()
      .raw(TextFileNames.Technologies)
      .eol();

    if (semver.lt(savingContext.version.numbering, "2.0.0")) {
      textFileWriter.raw(TextFileNames.TribeAi).eol();
    }

    textFileWriter.close();
  }

  writeToJsonFile(outputDirectory: string, savingContext: SavingContext) {
    clearDirectory(outputDirectory);
    writeHabitatsToJsonFiles(outputDirectory, this.habitats, savingContext);
    writeColormapsToJsonFiles(outputDirectory, this.colormaps, savingContext);
    writeSoundEffectsToJsonFiles(
      outputDirectory,
      this.soundEffects,
      savingContext,
    );
    writeSpritesToJsonFiles(outputDirectory, this.sprites, savingContext);
    writeTerrainsToJsonFiles(outputDirectory, this.terrains, savingContext);
    writeOverlaysToJsonFiles(outputDirectory, this.overlays, savingContext);
    writeBordersToJsonFiles(outputDirectory, this.borders, savingContext);
    writeMapPropertiesToJsonFile(
      outputDirectory,
      this.mapProperties,
      savingContext,
    );
    writeTribeRandomMapsToJsonFiles(
      outputDirectory,
      this.tribeRandomMaps,
      savingContext,
    );
    writeRandomMapsToJsonFiles(outputDirectory, this.randomMaps, savingContext);
    writeStateEffectsToJsonFiles(
      outputDirectory,
      this.stateEffects,
      savingContext,
    );
    writeCivilizationsToJsonFiles(
      outputDirectory,
      this.civilizations,
      savingContext,
    );
    writeObjectPrototypesToJsonFiles(
      outputDirectory,
      this.baselineObjects,
      this.objects,
      savingContext,
    );
    writeTechnologiesToJsonFiles(
      outputDirectory,
      this.technologies,
      savingContext,
    );
    writeTribeAisToJsonFiles(outputDirectory, this.tribeAi, savingContext);

    writeFileSync(
      path.join(outputDirectory, `version.json`),
      createJson({
        version: {
          numbering: savingContext.version.numbering,
          flavor: savingContext.version.flavor,
        },
        jsonVersion: "0.0.0",
      }),
    );

    Logger.info(`Finished writing JSON files`);
  }

  writeResourceLists(outputDirectory: string) {
    writeSoundEffectsResourceList(outputDirectory, this.soundEffects);
    writeSpriteResourceList(outputDirectory, this.sprites);
    writeTerrainsResourceList(outputDirectory, this.terrains);
    writeBordersResourceList(outputDirectory, this.borders);
    writeOverlaysResourceList(outputDirectory, this.overlays);
  }
}
