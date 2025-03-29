import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../../BufferReader";
import { Point } from "../../geometry/Point";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { TerrainId } from "../Types";
import {
  asBool8,
  asInt16,
  asInt32,
  asUInt16,
  asUInt8,
  Bool8,
  Int16,
  Int16Schema,
  Int32,
  NullPointer,
  Pointer,
  UInt16,
  UInt8,
} from "../../ts/base-types";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { SavingContext } from "../SavingContext";
import { createJson } from "../../json/json-serialization";
import { z } from "zod";

interface TileProperty {
  width: Int16;
  height: Int16;
  yDelta: Int16;
}

export const TileTypeDeltaYMultiplier = [
  0, -1, 1, -1, -1, -1, 1, -1, 1, -1, 1, -1, -1, -1, 1, 1, 1, 0, 0,
];

const MapPropertiesSchema = z.object({
  tileWidth: Int16Schema,
  tileHeight: Int16Schema,
  elevationHeight: Int16Schema,
});
type MapPropertiesJson = z.infer<typeof MapPropertiesSchema>;

// TODO: Split or rename this since it has all kinds of different mostly unused stuff
export class MapProperties {
  // All of these fields are actually ignored in the final version of the game. Early versions read the tile dimensions but also skip the rest...
  virtualTable: Pointer = NullPointer;
  mapTilesPointer: Pointer = NullPointer;
  mapWidth: Int32 = asInt32(0);
  mapHeight: Int32 = asInt32(0);
  worldWidth: Int32 = asInt32(0);
  worldHeight: Int32 = asInt32(0);
  tileProperties: TileProperty[] = [];
  padding008A: UInt16 = asUInt16(0); // 2 bytes

  mapTileRowOffsets: Pointer = NullPointer;

  maxTerrainCount: Int16 = asInt16(0);
  tileWidthPx: Int16 = asInt16(0);
  tileHeightPx: Int16 = asInt16(0);
  tileHalfHeightPx: Int16 = asInt16(0);
  tileHalfWidthPx: Int16 = asInt16(0);
  elevationHeightPx: Int16 = asInt16(0);
  // TODO: is this a point? (This is NOT overwritten on load?!)
  currentLocation: Point<Int16> = {
    x: asInt16(0),
    y: asInt16(0),
  };
  // TODO: is this a rectangle? (This is NOT overwritten on load?!)
  blockStartRow: Int16 = asInt16(0);
  blockEndRow: Int16 = asInt16(0);
  blockStartColumn: Int16 = asInt16(0);
  blockEndColumn: Int16 = asInt16(0);

  anyFrameChange: Bool8 = asBool8(false); // This is NOT overwritten on load?!
  zoneMap: TerrainId<UInt8>[] = [];
  padding8DAD: UInt8 = asUInt8(0); // 1 byte
  padding8DAE: UInt16 = asUInt16(0); // 2 bytes

  searchMapPointer: Pointer = NullPointer;
  searchMapRowsPointer: Pointer = NullPointer;

  tribeRandomMapGeneratorPointer: Pointer = NullPointer;

  mapVisible: Bool8 = asBool8(false);
  fogEnabled: Bool8 = asBool8(false);

  padding8DBA: UInt16 = asUInt16(0); // 2 bytes
  randomMapGeneratorPointer: Pointer = NullPointer;
  gameStatePointer: Pointer = NullPointer;
  mapZonesPointer: Pointer = NullPointer;

  mapVisibilityManagerPointer: Pointer = NullPointer;
  unitVisibilityManagerPointer: Pointer = NullPointer;

  randomMapEntriesPointer: Pointer = NullPointer;

  readMainDataFromBuffer(
    buffer: BufferReader,
    loadingContext: LoadingContext,
  ): void {
    this.virtualTable = buffer.readPointer();
    this.mapTilesPointer = buffer.readPointer();
    this.mapWidth = buffer.readInt32();
    this.mapHeight = buffer.readInt32();
    this.worldHeight = buffer.readInt32();
    this.worldWidth = buffer.readInt32();
    this.tileProperties = [];
    for (let i = 0; i < 19; ++i) {
      this.tileProperties.push({
        width: buffer.readInt16(),
        height: buffer.readInt16(),
        yDelta: semver.gte(loadingContext.version.numbering, "3.7.0")
          ? buffer.readInt16()
          : asInt16(0), // fallback is filled in later
      });
    }
    if (semver.gte(loadingContext.version.numbering, "3.7.0")) {
      this.padding008A = buffer.readUInt16();
    }
  }

  readSecondaryDataFromBuffer(
    buffer: BufferReader,
    _loadingContext: LoadingContext,
  ): void {
    this.mapTileRowOffsets = buffer.readPointer();
  }

  readTertiaryDataFromBuffer(
    buffer: BufferReader,
    loadingContext: LoadingContext,
  ): void {
    this.maxTerrainCount = buffer.readInt16();
    this.tileWidthPx = buffer.readInt16();
    this.tileHeightPx = buffer.readInt16();
    this.tileHalfHeightPx = buffer.readInt16();
    this.tileHalfWidthPx = buffer.readInt16();
    this.elevationHeightPx = buffer.readInt16();
    this.currentLocation.x = buffer.readInt16();
    this.currentLocation.y = buffer.readInt16();
    this.blockStartRow = buffer.readInt16();
    this.blockEndRow = buffer.readInt16();
    this.blockStartColumn = buffer.readInt16();
    this.blockEndColumn = buffer.readInt16();
    this.anyFrameChange = buffer.readBool8();

    if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
      this.zoneMap = [];
      for (let i = 0; i < 255; ++i) {
        this.zoneMap.push(buffer.readUInt8<TerrainId<UInt8>>());
      }
    } else {
      this.padding8DAD = buffer.readUInt8();
    }
    this.padding8DAE = buffer.readUInt16();

    this.searchMapPointer = buffer.readPointer();
    this.searchMapRowsPointer = buffer.readPointer();

    if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
      this.tribeRandomMapGeneratorPointer = buffer.readPointer();
    }

    this.mapVisible = buffer.readBool8();
    this.fogEnabled = buffer.readBool8();
    this.padding8DBA = buffer.readUInt16();

    if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
      this.randomMapGeneratorPointer = buffer.readPointer();
      this.gameStatePointer = buffer.readPointer();
      this.mapZonesPointer = buffer.readPointer();
      this.mapVisibilityManagerPointer = buffer.readPointer();
      this.unitVisibilityManagerPointer = buffer.readPointer();
    }

    if (semver.lt(loadingContext.version.numbering, "3.7.0")) {
      const baseDeltaValue = Math.floor(this.elevationHeightPx / 2);
      for (let i = 0; i < 19; ++i) {
        this.tileProperties[i].yDelta = asInt16(
          TileTypeDeltaYMultiplier[i] * baseDeltaValue,
        );
      }
    }
  }

  readQuaterniaryDataFromBuffer(
    buffer: BufferReader,
    loadingContext: LoadingContext,
  ): void {
    if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
      this.randomMapEntriesPointer = buffer.readPointer();
    }
  }

  readFromJsonFile(
    jsonFile: MapPropertiesJson,
    _loadingContext: JsonLoadingContext,
  ) {
    this.tileWidthPx = jsonFile.tileWidth;
    this.tileHeightPx = jsonFile.tileHeight;
    this.elevationHeightPx = jsonFile.elevationHeight;
    this.tileHalfHeightPx = asInt16(Math.floor(this.tileHeightPx / 2));
    this.tileHalfWidthPx = asInt16(Math.floor(this.tileWidthPx / 2));
    this.tileProperties = [
      {
        width: this.tileWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.elevationHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: asInt16(this.tileHeightPx + this.elevationHeightPx),
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.elevationHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: asInt16(this.tileHeightPx + this.elevationHeightPx),
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.elevationHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: asInt16(this.tileHeightPx + this.elevationHeightPx),
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.elevationHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: asInt16(this.tileHeightPx + this.elevationHeightPx),
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.elevationHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: asInt16(this.tileHeightPx + this.elevationHeightPx),
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileHalfWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
      {
        width: this.tileHalfWidthPx,
        height: this.tileHeightPx,
        yDelta: asInt16(0),
      },
    ];
    const baseDeltaValue = Math.floor(this.elevationHeightPx / 2);
    for (let i = 0; i < 19; ++i) {
      this.tileProperties[i].yDelta = asInt16(
        TileTypeDeltaYMultiplier[i] * baseDeltaValue,
      );
    }
  }

  static readFromJsonFile(
    inputDirectory: string,
    loadingContext: JsonLoadingContext,
  ) {
    const mapProperties = new MapProperties();
    const mapPropertiesJson = MapPropertiesSchema.parse(
      JSON5.parse(
        readFileSync(path.join(inputDirectory, "tileProperties.json")).toString(
          "utf8",
        ),
      ),
    );
    mapProperties.readFromJsonFile(mapPropertiesJson, loadingContext);
    return mapProperties;
  }
}

export function writeMapPropertiesToJsonFile(
  directory: string,
  mapProperties: MapProperties,
  _savingContext: SavingContext,
) {
  writeFileSync(
    path.join(directory, `tileProperties.json`),
    createJson({
      tileWidth: mapProperties.tileWidthPx,
      tileHeight: mapProperties.tileHeightPx,
      elevationHeight: mapProperties.elevationHeightPx,
    }),
  );
}
