import semver from 'semver';
import BufferReader from "../../BufferReader";
import { Point, Point3D, Point3DSchema, PointSchema } from "../../geometry/Point";
import { Logger } from "../../Logger";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { AttributeId, HabitatId, PaletteIndex, PaletteIndexSchema, PrototypeId, ReferenceStringSchema, SoundEffectId, SpriteId, StringId, StringIdSchema, TerrainId } from "../Types";
import { asBool8, asFloat32, asInt16, asInt32, asUInt8, Bool8, Bool8Schema, Float32, Float32Schema, Int16, Int16Schema, Int32, Int32Schema, UInt8, UInt8Schema } from "../../ts/base-types";
import { ObjectClass, ObjectClasses, ObjectClassSchema } from "./ObjectClass";
import { ObjectType, ObjectTypes, ObjectTypeSchema } from "./ObjectType";
import { createReferenceString, createReferenceIdFromString, getIdFromReferenceString } from '../../json/reference-id';
import { SoundEffect } from '../SoundEffect';
import { Terrain } from '../landscape/Terrain';
import { Habitat } from '../landscape/Habitat';
import { Sprite } from '../Sprite';
import { Nullable, trimEnd } from '../../ts/ts-utils';
import { getDataEntry } from '../../util';
import { applyJsonFieldsToObject, JsonFieldMapping, transformObjectToJson } from '../../json/json-serialization';
import { Technology } from '../research/Technology';
import { Overlay } from '../landscape/Overlay';
import { z } from 'zod';

interface AttributeStorage {
    attributeId: AttributeId<Int16>;
    amount: Float32;
    storageType: UInt8;
}

interface DamageSprite {
    spriteId: SpriteId;
    sprite: Sprite | null;
    damagePercent: UInt8;
    padding05: UInt8; // this is actually contains the same data as applyMode
    applyMode: UInt8;
}

export const SceneryObjectPrototypeSchema = z.object({
    objectType: ObjectTypeSchema,
    internalName: z.string(),
    nameStringId: StringIdSchema(Int16Schema),
    creationStringId: StringIdSchema(Int16Schema).optional(),
    objectClass: ObjectClassSchema,
    idleSpriteId: ReferenceStringSchema,
    deathSpriteId: ReferenceStringSchema,
    undeadSpriteId: ReferenceStringSchema,
    undead: Bool8Schema,
    hitpoints: Int16Schema,
    lineOfSight: Float32Schema,
    garrisonCapacity: UInt8Schema,
    collisionRadius: Point3DSchema(Float32Schema),
    creationSoundId: ReferenceStringSchema,
    deadUnitPrototypeId: ReferenceStringSchema,
    sortNumber: UInt8Schema,
    canBeBuiltOn: UInt8Schema,
    iconNumber: Int16Schema,
    hiddenInEditor: Bool8Schema,
    portraitPicture: Int16Schema.optional(),
    unlocked: Bool8Schema,
    placementNeighbouringTerrainIds: z.array(ReferenceStringSchema).max(2).optional(),
    placementUnderlyingTerrainIds: z.array(ReferenceStringSchema).max(2).optional(),
    clearanceSize: PointSchema(Float32Schema),
    elevationMode: UInt8Schema,
    fogVisibility: UInt8Schema,
    habitatId: ReferenceStringSchema,
    flyMode: UInt8Schema,
    attributeCapacity: Int16Schema,
    attributeDecayRate: Float32Schema,
    blastDefenseLevel: UInt8Schema,
    combatMode: UInt8Schema,
    interactionMode: UInt8Schema,
    minimapMode: UInt8Schema,
    minimapColor: PaletteIndexSchema,
    interfaceType: UInt8Schema,
    multipleAttributeMode: Float32Schema.optional(),
    helpDialogStringId: StringIdSchema(Int32Schema).optional(),
    helpPageStringId: StringIdSchema(Int32Schema).optional(),
    hotkeyStringId: StringIdSchema(Int32Schema).optional(),
    reusable: Bool8Schema.optional(),
    trackAsResource: Bool8Schema.optional(),
    doppelgangerMode: UInt8Schema.optional(),
    resourceGroup: UInt8Schema.optional(),
    selectionOutlineFlags: UInt8Schema.optional(),
    editorSelectionOutlineColor: PaletteIndexSchema.optional(),
    selectionOutlineRadius: Point3DSchema(Float32Schema).optional(),
    attributesStored: z.array(z.object({
        attributeId: Int16Schema,
        amount: Float32Schema,
        storageType: UInt8Schema,
    })),
    damageSprites: z.array(z.object({
        spriteId: ReferenceStringSchema,
        damagePercent: UInt8Schema,
        applyMode: UInt8Schema,
    })),
    selectionSoundId: ReferenceStringSchema,
    deathSoundId: ReferenceStringSchema,
    attackReaction: UInt8Schema.optional(),
    convertTerrain: Bool8Schema.optional(),
    upgradeUnitPrototypeId: ReferenceStringSchema.optional(),
});

export type SceneryObjectPrototypeJson = z.infer<typeof SceneryObjectPrototypeSchema>;

function isTrackedAsResource(prototype: SceneryObjectPrototype) {
    return asBool8([ObjectClasses.Fish, ObjectClasses.ForageFruit, ObjectClasses.StoneOrGoldMine, ObjectClasses.StoneMine, ObjectClasses.GoldMine, ObjectClasses.Tree].includes(prototype.objectClass));
}

function getResourceGatherGroup(prototype: SceneryObjectPrototype) {
    switch (prototype.objectClass) {
        case ObjectClasses.Tree:
            return 0;
        case ObjectClasses.ForageFruit:
            return 1;
        case ObjectClasses.Fish:
            return 2;
        case ObjectClasses.StoneOrGoldMine:
            if (prototype.attributesStored.some(attribute => attribute.attributeId === 2)) {
                return 3;
            }
            else if (prototype.attributesStored.some(attribute => attribute.attributeId === 3)) {
                return 4;
            }
            else {
                Logger.warn(`Could not determine mine type ${prototype.id} resource group`)
            }
            break;
        case ObjectClasses.GoldMine:
            return 4;
        default:
            Logger.warn(`Tried to get resourceGatherGroup but ${prototype.id} is not a resource`)
            break;
    }
    return 0;
}

function getResourceDoppelgangerMode(prototype: SceneryObjectPrototype) {
    if (isTrackedAsResource(prototype)) {
        return asUInt8(prototype.objectClass == ObjectClasses.Tree ? 2 : 1);
    }
    else {
        return asUInt8(0);
    }
}

const SceneryObjectPrototypeJsonMapping: JsonFieldMapping<SceneryObjectPrototype, SceneryObjectPrototypeJson>[] = [
    { field: "objectType" },
    { field: "internalName" },
    { field: "nameStringId" },
    { field: "creationStringId", versionFrom: "1.5.0" },
    { field: "objectClass" },
    { jsonField: "idleSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.idleSprite?.referenceId, obj.idleSpriteId) },
    { objectField: "idleSpriteId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<SpriteId>("Sprite", obj.referenceId, json.idleSpriteId, loadingContext.dataIds.spriteIds) },
    { jsonField: "deathSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.deathSprite?.referenceId, obj.deathSpriteId) },
    { objectField: "deathSpriteId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<SpriteId>("Sprite", obj.referenceId, json.deathSpriteId, loadingContext.dataIds.spriteIds) },
    { jsonField: "undeadSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.undeadSprite?.referenceId, obj.undeadSpriteId) },
    { objectField: "undeadSpriteId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<SpriteId>("Sprite", obj.referenceId, json.undeadSpriteId, loadingContext.dataIds.spriteIds) },
    { field: "undead" },
    { field: "hitpoints" },
    { field: "lineOfSight" },
    { field: "garrisonCapacity" },
    { field: "collisionRadius" },
    { jsonField: "creationSoundId", toJson: (obj) => createReferenceString("SoundEffect", obj.creationSound?.referenceId, obj.creationSoundId)},
    { objectField: "creationSoundId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<SoundEffectId<Int16>>("SoundEffect", obj.referenceId, json.creationSoundId, loadingContext.dataIds.soundEffectIds) },
    { jsonField: "deadUnitPrototypeId", toJson: (obj) => createReferenceString("ObjectPrototype", obj.deadUnitPrototype?.referenceId, obj.deadUnitPrototypeId)},
    { objectField: "deadUnitPrototypeId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<PrototypeId<Int16>>("ObjectPrototype", obj.referenceId, json.deadUnitPrototypeId, loadingContext.dataIds.prototypeIds) },
    { field: "sortNumber" },
    { field: "canBeBuiltOn" },
    { field: "iconNumber" },
    { field: "hiddenInEditor" },
    { field: "portraitPicture", flags: { unusedField: true } },
    { field: "unlocked" },
    { jsonField: "placementNeighbouringTerrainIds", toJson: (obj) => {
        return obj.placementNeighbouringTerrains.slice(0, trimEnd(obj.placementNeighbouringTerrainIds, terrainId => terrainId === -1).length)
            .map((terrain, index) => createReferenceString("Terrain", terrain?.referenceId, obj.placementNeighbouringTerrainIds[index]));
    }},
    { objectField: "placementNeighbouringTerrainIds", fromJson: (json, obj, loadingContext) => json.placementNeighbouringTerrainIds?.map(terrainId => getIdFromReferenceString<TerrainId<Int16>>("Terrain", obj.referenceId, terrainId, loadingContext.dataIds.terrainIds)) ?? [] },
    { jsonField: "placementUnderlyingTerrainIds", toJson: (obj) => {
        return obj.placementUnderlyingTerrains.slice(0, trimEnd(obj.placementUnderlyingTerrainIds, terrainId => terrainId === -1).length)
            .map((terrain, index) => createReferenceString("Terrain", terrain?.referenceId, obj.placementUnderlyingTerrainIds[index]));
    }},
    { objectField: "placementUnderlyingTerrainIds", versionFrom: "1.4.0", fromJson: (json, obj, loadingContext) => json.placementUnderlyingTerrainIds?.map(terrainId => getIdFromReferenceString<TerrainId<Int16>>("Terrain", obj.referenceId, terrainId, loadingContext.dataIds.terrainIds)) ?? [] },
    { field: "clearanceSize" },
    { field: "elevationMode" },
    { field: "fogVisibility" },
    { jsonField: "habitatId", toJson: (obj) => createReferenceString("Habitat", obj.habitat?.referenceId, obj.habitatId) },
    { objectField: "habitatId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<Int16>("Habitat", obj.referenceId, json.habitatId, loadingContext.dataIds.habitatIds) },
    { field: "flyMode" },
    { field: "attributeCapacity" },
    { field: "attributeDecayRate" },
    { field: "blastDefenseLevel" },
    { field: "combatMode" },
    { field: "interactionMode" },
    { field: "minimapMode" },
    { field: "minimapColor" },
    { field: "interfaceType" },
    { field: "multipleAttributeMode", flags: { unusedField: true } },
    { field: "minimapColor" },
    { field: "helpDialogStringId", versionFrom: "2.7.0" },
    { field: "helpPageStringId",versionFrom: "2.7.0" },
    { field: "hotkeyStringId", versionFrom: "2.7.0" },
    { field: "reusable", versionFrom: "2.7.0", flags: { internalField: true } },
    { field: "trackAsResource", versionFrom: "3.1.0" },
    { field: "doppelgangerMode", versionFrom: "3.1.0" },
    { field: "resourceGroup", versionFrom: "3.1.0" },
    { field: "selectionOutlineFlags", versionFrom: "3.3.0" },
    { field: "editorSelectionOutlineColor", versionFrom: "3.3.0" },
    { field: "selectionOutlineRadius", versionFrom: "3.3.0" },
    { jsonField: "attributesStored", toJson: (obj) => trimEnd(obj.attributesStored, entry => entry.attributeId === -1) },
    { objectField: "attributesStored", fromJson: (json, obj, loadingContext) => json.attributesStored },
    { jsonField: "damageSprites", toJson: (obj) => obj.damageSprites.map(damageSprite => ({
        spriteId: createReferenceString("Sprite", damageSprite.sprite?.referenceId, damageSprite.spriteId),
        damagePercent: damageSprite.damagePercent,
        applyMode: damageSprite.applyMode
    }))},
    { objectField: "damageSprites", fromJson: (json, obj, loadingContext) => json.damageSprites.map(damageSprite => ({
        spriteId: getIdFromReferenceString<SpriteId>("Sprite", obj.referenceId, damageSprite.spriteId, loadingContext.dataIds.spriteIds),
        sprite: null,
        damagePercent: damageSprite.damagePercent,
        padding05: asUInt8(0),
        applyMode: damageSprite.applyMode
    }))},
    { jsonField: "selectionSoundId", toJson: (obj) => createReferenceString("SoundEffect", obj.selectionSound?.referenceId, obj.selectionSoundId) },
    { objectField: "selectionSoundId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<SoundEffectId<Int16>>("SoundEffect", obj.referenceId, json.selectionSoundId, loadingContext.dataIds.soundEffectIds )},
    { jsonField: "deathSoundId", toJson: (obj) => createReferenceString("SoundEffect", obj.deathSound?.referenceId, obj.deathSoundId) },
    { objectField: "deathSoundId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<SoundEffectId<Int16>>("SoundEffect", obj.referenceId, json.deathSoundId, loadingContext.dataIds.soundEffectIds )},
    { field: "attackReaction", flags: { unusedField: true } },
    { field: "convertTerrain", flags: { unusedField: true } },
    { jsonField: "upgradeUnitPrototypeId", flags: { internalField: true }, toJson: (obj) => createReferenceString("ObjectPrototype", obj.upgradeUnitPrototype?.referenceId, obj.upgradeUnitPrototypeId ) },
    { objectField: "upgradeUnitPrototypeId", flags: { internalField: true }, fromJson: (json, obj, loadingContext) => json.upgradeUnitPrototypeId !== undefined ? getIdFromReferenceString<PrototypeId<Int16>>("ObjectPrototype", obj.referenceId, json.upgradeUnitPrototypeId, loadingContext.dataIds.prototypeIds) : undefined },
  ];

export class SceneryObjectPrototype {
    referenceId: string = "";
    id: PrototypeId<Int16> = asInt16<PrototypeId<Int16>>(-1);
    internalName: string = "";
    objectType: ObjectType = ObjectTypes.None;
    nameStringId: StringId<Int16> = asInt16<StringId<Int16>>(-1);
    creationStringId: StringId<Int16> = asInt16<StringId<Int16>>(-1);
    objectClass: ObjectClass = ObjectClasses.None;
    idleSpriteId: SpriteId = asInt16<SpriteId>(-1);
    idleSprite: Sprite | null = null;
    deathSpriteId: SpriteId = asInt16<SpriteId>(-1);
    deathSprite: Sprite | null = null;
    undeadSpriteId: SpriteId = asInt16<SpriteId>(-1);
    undeadSprite: Sprite | null = null;
    undead: Bool8 = asBool8(false);
    hitpoints: Int16 = asInt16(0);
    lineOfSight: Float32 = asFloat32(0);
    garrisonCapacity: UInt8 = asUInt8(0);
    collisionRadius: Point3D<Float32> = {
        x: asFloat32(0),
        y: asFloat32(0),
        z: asFloat32(0)
    }

    creationSoundId: SoundEffectId<Int16> = asInt16<SoundEffectId<Int16>>(-1);
    creationSound: SoundEffect | null = null;
    deadUnitPrototypeId: PrototypeId<Int16> = asInt16<PrototypeId<Int16>>(-1);
    deadUnitPrototype: SceneryObjectPrototype | null = null;
    sortNumber: UInt8 = asUInt8(0);
    canBeBuiltOn: UInt8 = asUInt8(0);
    iconNumber: Int16 = asInt16(-1);
    hiddenInEditor: Bool8 = asBool8(false);
    portraitPicture: Int16 = asInt16(-1); // obsolete(?)
    unlocked: Bool8 = asBool8(true);
    placementNeighbouringTerrainIds: TerrainId<Int16>[] = [];
    placementNeighbouringTerrains: Nullable<Terrain>[] = [];
    placementUnderlyingTerrainIds: TerrainId<Int16>[] = [];
    placementUnderlyingTerrains: Nullable<Terrain>[] = [];
    clearanceSize: Point<Float32> = {
        x: asFloat32(0),
        y: asFloat32(0)
    };
    elevationMode: UInt8 = asUInt8(0);
    fogVisibility: UInt8 = asUInt8(0);
    habitatId: HabitatId = asInt16<HabitatId>(-1); // this habitat is used for passability checks (e.g. bland unit or boat)
    habitat: Habitat | null = null;
    flyMode: UInt8 = asUInt8(0);
    attributeCapacity: Int16 = asInt16(0);
    attributeDecayRate: Float32 = asFloat32(0);
    blastDefenseLevel: UInt8 = asUInt8(0);
    combatMode: UInt8 = asUInt8(0);
    interactionMode: UInt8 = asUInt8(0);
    minimapMode: UInt8 = asUInt8(0);
    interfaceType: UInt8 = asUInt8(0);
    multipleAttributeMode: Float32 = asFloat32(0);
    minimapColor: PaletteIndex = asUInt8<PaletteIndex>(0);
    helpDialogStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1); // The game actually only supports 16-bit string indexes, higher values will overflow
    helpPageStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
    hotkeyStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);

    reusable: Bool8 = asBool8(false);
    trackAsResource: Bool8 = asBool8(false);
    doppelgangerMode: UInt8 = asUInt8(0);
    resourceGroup: UInt8 = asUInt8(0);

    selectionOutlineFlags: UInt8 = asUInt8(0); // 0x1 = Always show outline in editor; 0x2 = Don't show health bar
    editorSelectionOutlineColor: PaletteIndex = asUInt8<PaletteIndex>(0);
    selectionOutlineRadius: Point3D<Float32> = {
        x: asFloat32(0),
        y: asFloat32(0),
        z: asFloat32(0)
    };
    attributesStored: AttributeStorage[] = [];
    damageSprites: DamageSprite[] = [];

    selectionSoundId: SoundEffectId<Int16> = asInt16<SoundEffectId<Int16>>(-1);
    selectionSound: SoundEffect | null = null;
    deathSoundId: SoundEffectId<Int16> = asInt16<SoundEffectId<Int16>>(-1);
    deathSound: SoundEffect | null = null;
    attackReaction: UInt8 = asUInt8(0);
    convertTerrain: Bool8 = asBool8(false);
    upgradeUnitPrototypeId: PrototypeId<Int16> = asInt16<PrototypeId<Int16>>(-1); // internal field, should definitely not be modified
    upgradeUnitPrototype: SceneryObjectPrototype | null = null;
    
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        const nameLength = buffer.readInt16();
        this.id = buffer.readInt16<PrototypeId<Int16>>();
        if (this.id !== id) {
            Logger.warn(`Mismatch between stored Object id ${this.id} and ordering ${id}, data might be corrupt!`);
        }
        this.nameStringId = buffer.readInt16<StringId<Int16>>();
        if (semver.gte(loadingContext.version.numbering, "1.5.0")) {
            this.creationStringId = buffer.readInt16<StringId<Int16>>();
        }
        else {
            this.creationStringId = asInt16<StringId<Int16>>(-1);
        }
        this.objectClass = buffer.readInt16<ObjectClass>();
        this.idleSpriteId = buffer.readInt16<SpriteId>();
        this.deathSpriteId = buffer.readInt16<SpriteId>();
        this.undeadSpriteId = buffer.readInt16<SpriteId>();
        this.undead = buffer.readBool8();
        this.hitpoints = buffer.readInt16();
        this.lineOfSight = buffer.readFloat32();
        this.garrisonCapacity = buffer.readUInt8();
        this.collisionRadius = {
            x: buffer.readFloat32(),
            y: buffer.readFloat32(),
            z: buffer.readFloat32(),
        };
        this.creationSoundId = buffer.readInt16<SoundEffectId<Int16>>();
        this.deadUnitPrototypeId = buffer.readInt16<PrototypeId<Int16>>();
        this.sortNumber = buffer.readUInt8();
        this.canBeBuiltOn = buffer.readUInt8();
        this.iconNumber = buffer.readInt16();
        this.hiddenInEditor = buffer.readBool8();
        this.portraitPicture = buffer.readInt16();
        this.unlocked = buffer.readBool8();
        
        // TODO: Filter based on load context
        const requiredNeighbouringTerrains: TerrainId<Int16>[] = [];
        this.placementNeighbouringTerrainIds = [];
        for (let i = 0; i < 2; ++i) {
            requiredNeighbouringTerrains.push(buffer.readInt16<TerrainId<Int16>>());
        }
        this.placementNeighbouringTerrainIds = requiredNeighbouringTerrains;

        if (semver.gte(loadingContext.version.numbering, "1.4.0")) {
            const requiredUnderlyingTerrains: TerrainId<Int16>[] = [];
            this.placementUnderlyingTerrainIds = [];
            for (let i = 0; i < 2; ++i) {
                requiredUnderlyingTerrains.push(buffer.readInt16<TerrainId<Int16>>());
            }
            this.placementUnderlyingTerrainIds = requiredUnderlyingTerrains;
        }
        else {
            this.placementUnderlyingTerrainIds = [asInt16<TerrainId<Int16>>(-1), asInt16<TerrainId<Int16>>(-1)];
        }

        this.clearanceSize = {
            x: buffer.readFloat32(),
            y: buffer.readFloat32()
        }
        this.elevationMode = buffer.readUInt8();
        this.fogVisibility = buffer.readUInt8();
        this.habitatId = buffer.readInt16<HabitatId>();

        this.flyMode = buffer.readUInt8();
        this.attributeCapacity = buffer.readInt16();
        this.attributeDecayRate = buffer.readFloat32();
        
        this.blastDefenseLevel = buffer.readUInt8();
        this.combatMode = buffer.readUInt8();
        this.interactionMode = buffer.readUInt8();

        this.minimapMode = buffer.readUInt8();
        this.interfaceType = buffer.readUInt8();

        this.multipleAttributeMode = buffer.readFloat32();
        this.minimapColor = buffer.readUInt8<PaletteIndex>();

        if (semver.gte(loadingContext.version.numbering, "2.7.0")) {
            this.helpDialogStringId = buffer.readInt32<StringId<Int32>>();
            this.helpPageStringId = buffer.readInt32<StringId<Int32>>();
            this.hotkeyStringId = buffer.readInt32<StringId<Int32>>();
            this.reusable = buffer.readBool8();
        }
        else {
            this.helpDialogStringId = asInt32<StringId<Int32>>(this.nameStringId >= 5000 && this.nameStringId < 6000 ? this.nameStringId + 100000 : 0);
            this.helpPageStringId = asInt32<StringId<Int32>>(this.nameStringId >= 5000 && this.nameStringId < 6000 ? this.nameStringId + 150000 : 0);
            this.hotkeyStringId = asInt32<StringId<Int32>>(this.nameStringId >= 5000 && this.nameStringId < 6000 && this.creationStringId > 0 ? this.nameStringId + 11001 : 0);
            this.reusable = asBool8(this.objectClass === ObjectClasses.Miscellaneous || this.objectType == ObjectTypes.Doppelganger);
        }

        // The fallbacks for these are later because they need attributes which have not yet been read
        if (semver.gte(loadingContext.version.numbering, "3.1.0")) {
            this.trackAsResource = buffer.readBool8();
            this.doppelgangerMode = buffer.readUInt8();
            this.resourceGroup = buffer.readUInt8();
        }

        if (semver.gte(loadingContext.version.numbering, "3.3.0")) {
            this.selectionOutlineFlags = buffer.readUInt8();
            this.editorSelectionOutlineColor = buffer.readUInt8<PaletteIndex>();
            this.selectionOutlineRadius = {
                x: buffer.readFloat32(),
                y: buffer.readFloat32(),
                z: buffer.readFloat32()
            };
        }
        else {
            this.selectionOutlineFlags = asUInt8(0);
            this.editorSelectionOutlineColor = asUInt8<PaletteIndex>(0);
            this.selectionOutlineRadius = {
                x: this.collisionRadius.x,
                y: this.collisionRadius.y,
                z: this.collisionRadius.z,
            }
        }

        // TODO: Filter unused based on loading context
        const attributeTypes: AttributeId<Int16>[] = [];
        const attributeAmounts: Float32[] = [];
        const attributeStorageType: UInt8[] = [];
        for (let i = 0; i < 3; ++i) {
            attributeTypes.push(buffer.readInt16());
            attributeAmounts.push(buffer.readFloat32());
            attributeStorageType.push(buffer.readUInt8());
        }
        this.attributesStored = [];
        for (let i = 0; i < 3; ++i) {
            this.attributesStored.push({
                attributeId: attributeTypes[i],
                amount: attributeAmounts[i],
                storageType: attributeStorageType[i]
            });
        }

        const damageSpriteCount = buffer.readUInt8();
        this.damageSprites = [];
        for (let i = 0; i < damageSpriteCount; ++i) {
            this.damageSprites.push({
                spriteId: buffer.readInt16<SpriteId>(),
                sprite: null,
                damagePercent: buffer.readUInt8(),
                padding05: buffer.readUInt8(),
                applyMode: buffer.readUInt8()
            });
        }

        this.selectionSoundId = buffer.readInt16<SoundEffectId<Int16>>();
        this.deathSoundId = buffer.readInt16<SoundEffectId<Int16>>();
        this.attackReaction = buffer.readUInt8();
        this.convertTerrain = buffer.readBool8();

        this.internalName = nameLength > 0 ? buffer.readFixedSizeString(nameLength) : "";
        this.referenceId = createReferenceIdFromString(this.internalName);
        if (semver.gte(loadingContext.version.numbering, "3.5.0")) {
            this.upgradeUnitPrototypeId = buffer.readInt16<PrototypeId<Int16>>();
            if (this.upgradeUnitPrototypeId !== this.id) {
                Logger.warn(`Mismatch between stored Object id ${this.id} and upgrade id ${this.upgradeUnitPrototypeId}, data might be corrupt!`);
            }
        }
        else {
            this.upgradeUnitPrototypeId = this.id;
        }

        if (semver.lt(loadingContext.version.numbering, "3.1.0")) {
            this.trackAsResource = isTrackedAsResource(this);
            this.resourceGroup = asUInt8(this.trackAsResource ? getResourceGatherGroup(this) : 0);
            this.doppelgangerMode = getResourceDoppelgangerMode(this);
        }
    }

    readFromJsonFile(jsonFile: SceneryObjectPrototypeJson, id: PrototypeId<Int16>, referenceId: string, loadingContext: JsonLoadingContext) {
        this.id = id;
        this.referenceId = referenceId;
        applyJsonFieldsToObject(jsonFile, this, SceneryObjectPrototypeJsonMapping, loadingContext);
        if (jsonFile.upgradeUnitPrototypeId === undefined) {
            this.upgradeUnitPrototypeId === this.id;
        }

        // 1.5.0+
        if (jsonFile.creationStringId === undefined) {
            this.creationStringId = asInt16<StringId<Int16>>(-1);
        }

        // 2.7.0+
        if (jsonFile.helpDialogStringId === undefined) {
            this.helpDialogStringId = asInt32<StringId<Int32>>(this.nameStringId >= 5000 && this.nameStringId < 6000 ? this.nameStringId + 100000 : 0);
        }
        if (jsonFile.helpPageStringId === undefined) {
            this.helpPageStringId = asInt32<StringId<Int32>>(this.nameStringId >= 5000 && this.nameStringId < 6000 ? this.nameStringId + 150000 : 0);
        }
        if (jsonFile.hotkeyStringId === undefined) {
            this.hotkeyStringId = asInt32<StringId<Int32>>(this.nameStringId >= 5000 && this.nameStringId < 6000 && this.creationStringId > 0 ? this.nameStringId + 11001 : 0);
        }
        if (jsonFile.reusable === undefined) {
            this.reusable = asBool8(this.objectClass === ObjectClasses.Miscellaneous || this.objectType == ObjectTypes.Doppelganger);
        }

        // 3.1.0+
        if (jsonFile.trackAsResource === undefined) {
            this.trackAsResource = isTrackedAsResource(this);
        }
        if (jsonFile.resourceGroup === undefined) {
            this.resourceGroup = asUInt8(this.trackAsResource ? getResourceGatherGroup(this) : 0);
        }
        if (jsonFile.doppelgangerMode === undefined) {
            this.doppelgangerMode = getResourceDoppelgangerMode(this);
        }

        // 3.3.0+
        if (jsonFile.selectionOutlineFlags === undefined) {
            this.selectionOutlineFlags = asUInt8(0);
        }
        if (jsonFile.editorSelectionOutlineColor === undefined) {
            this.editorSelectionOutlineColor = asUInt8<PaletteIndex>(0);
        }
        if (jsonFile.selectionOutlineRadius === undefined) {
            this.selectionOutlineRadius = {
                x: this.collisionRadius.x,
                y: this.collisionRadius.y,
                z: this.collisionRadius.z,
            }
        }
    }

    linkOtherData(
        sprites: Nullable<Sprite>[], soundEffects: Nullable<SoundEffect>[], terrains: Nullable<Terrain>[], habitats: Nullable<Habitat>[],
        objects: Nullable<SceneryObjectPrototype>[], technologies: Nullable<Technology>[], overlays: Nullable<Overlay>[], loadingContext: LoadingContext
    ) {
        this.idleSprite = getDataEntry(sprites, this.idleSpriteId, "Sprite", this.referenceId, loadingContext);
        this.deathSprite = getDataEntry(sprites, this.deathSpriteId, "Sprite", this.referenceId, loadingContext);
        this.undeadSprite = getDataEntry(sprites, this.undeadSpriteId, "Sprite", this.referenceId, loadingContext);
        this.damageSprites.forEach(damageSprite => {
            damageSprite.sprite = getDataEntry(sprites, damageSprite.spriteId, "Sprite", this.referenceId, loadingContext);
        })

        this.creationSound = getDataEntry(soundEffects, this.creationSoundId, "SoundEffect", this.referenceId, loadingContext);
        this.selectionSound = getDataEntry(soundEffects, this.selectionSoundId, "SoundEffect", this.referenceId, loadingContext);
        this.deathSound = getDataEntry(soundEffects, this.deathSoundId, "SoundEffect", this.referenceId, loadingContext);

        this.deadUnitPrototype = getDataEntry(objects, this.deadUnitPrototypeId, "ObjectPrototype", this.referenceId, loadingContext);
        this.upgradeUnitPrototype = getDataEntry(objects, this.upgradeUnitPrototypeId, "ObjectPrototype", this.referenceId, loadingContext);

        this.habitat = getDataEntry(habitats, this.habitatId, "Habitat", this.referenceId, loadingContext);

        this.placementNeighbouringTerrains = this.placementNeighbouringTerrainIds.map(terrainId => getDataEntry(terrains, terrainId, "Terrain", this.referenceId, loadingContext));
        this.placementUnderlyingTerrains = this.placementUnderlyingTerrainIds.map(terrainId => getDataEntry(terrains, terrainId, "Terrain", this.referenceId, loadingContext));
    }


    appendToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext) {
        textFileWriter.eol();

        if (semver.lt(savingContext.version.numbering, "2.0.0") && this.objectType % 10 !== 0) {
            throw new Error(`${this.objectType} is not supported by version ${savingContext.version}`);
        }

        textFileWriter
            .indent(2)
            .integer(semver.lt(savingContext.version.numbering, "2.0.0") ? this.objectType / 10 : this.objectType)
            .integer(this.id)
            .eol();

        textFileWriter
            .indent(4)
            .string(this.internalName, 26)
            .integer(this.nameStringId)
            .conditional(semver.gte(savingContext.version.numbering, "1.5.0"), writer => writer.integer(this.creationStringId))
            .integer(this.objectClass)
            .integer(this.idleSpriteId)
            .integer(this.deathSpriteId)
            .integer(this.undeadSpriteId)
            .integer(this.undead ? 1 : 0)
            .integer(this.hitpoints)
            .float(this.lineOfSight)
            .integer(this.garrisonCapacity)
            .float(this.collisionRadius.x)
            .float(this.collisionRadius.y)
            .float(this.collisionRadius.z)
            .integer(this.deadUnitPrototypeId)
            .integer(this.sortNumber)
            .integer(this.canBeBuiltOn)
            .integer(this.iconNumber)
            .integer(this.hiddenInEditor ? 1 : 0)
            .integer(this.portraitPicture)
            .integer(this.unlocked ? 1 : 0)
            .eol()

        const outlineRadius = this.selectionOutlineRadius.x !== this.collisionRadius.x ||
            this.selectionOutlineRadius.y !== this.collisionRadius.y ||
            this.selectionOutlineRadius.z !== this.collisionRadius.z;

        textFileWriter
            .indent(4)
            .integer(this.placementNeighbouringTerrainIds[0])
            .integer(this.placementNeighbouringTerrainIds[1])
            .conditional(semver.gte(savingContext.version.numbering, "1.4.0"), writer => writer
                .integer(this.placementUnderlyingTerrainIds[0])
                .integer(this.placementUnderlyingTerrainIds[1])
            )
            .float(this.clearanceSize.x)
            .float(this.clearanceSize.y)
            .integer(this.elevationMode)
            .integer(this.fogVisibility)
            .integer(this.habitatId)
            .eol()

        textFileWriter
            .indent(4)
            .integer(this.creationSoundId)
            .integer(this.flyMode)
            .integer(this.attributeCapacity)
            .float(this.multipleAttributeMode)
            .float(this.attributeDecayRate)
            .integer(this.blastDefenseLevel)
            .integer(this.combatMode)
            .integer(this.interactionMode)
            .integer(this.minimapMode)
            .integer(this.interfaceType)
            .integer(this.minimapColor)

        if (semver.gte(savingContext.version.numbering, "2.7.0")) {
            textFileWriter
                .integer(this.helpDialogStringId)
                .integer(this.helpPageStringId)
                .integer(this.hotkeyStringId)
        }

        if (semver.gte(savingContext.version.numbering, "3.1.0")) {
            textFileWriter
                .integer(this.trackAsResource ? 1 : 0)
                .integer(this.doppelgangerMode)
                .integer(this.resourceGroup)
        }

        if (semver.gte(savingContext.version.numbering, "3.3.0")) {
            textFileWriter
                .integer(this.selectionOutlineFlags)
                .integer(this.editorSelectionOutlineColor)
                .float(outlineRadius ? this.selectionOutlineRadius.x : this.collisionRadius.x)
                .float(outlineRadius ? this.selectionOutlineRadius.y : this.collisionRadius.y)
                .float(outlineRadius ? this.selectionOutlineRadius.z : this.collisionRadius.z);
        }

        for (let i = 0; i < 3; ++i) {
            textFileWriter
                .integer(this.attributesStored[i].attributeId)
                .float(this.attributesStored[i].amount)
                .integer(this.attributesStored[i].storageType);
        }
        textFileWriter.eol();

        textFileWriter
            .indent(6)
                .integer(this.damageSprites.length)
                .eol();

        this.damageSprites.forEach(damageSprite => {
            textFileWriter
                .indent(8)
                .integer(damageSprite.spriteId)
                .integer(damageSprite.damagePercent)
                .integer(damageSprite.applyMode)
                .eol();
        })

        textFileWriter
            .indent(4)
            .integer(this.selectionSoundId)
            .integer(this.deathSoundId)
            .integer(this.attackReaction)
            .integer(this.convertTerrain ? 1 : 0)
            .eol();
    }
    
    toJson(savingContext: SavingContext) {
        return transformObjectToJson(this, SceneryObjectPrototypeJsonMapping, savingContext)
    }
}
