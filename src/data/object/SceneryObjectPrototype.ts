import BufferReader from "../../BufferReader";
import { Point, Point3D } from "../../geometry/Point";
import { LoadingContext } from "../LoadingContext";
import { asBool8, asFloat32, asInt16, asInt32, asUInt8, AttributeId, Bool8, Float32, HabitatId, Int16, Int32, PaletteIndex, PrototypeId, SoundEffectId, SpriteId, StringId, TerrainId, UInt8 } from "../Types";
import { ObjectClass } from "./ObjectClass";
import { ObjectType } from "./ObjectType";

interface AttributeStorage {
    attributeId: AttributeId<Int16>;
    amount: Float32;
    storageType: UInt8;
}

interface DamageSprite {
    spriteId: SpriteId<Int16>;
    damagePercent: UInt8;
    padding05: UInt8; // this is actually contains the same data as applyMode
    applyMode: UInt8;
}

export class SceneryObjectPrototype {
    id: PrototypeId<Int16> = asInt16(-1);
    internalName: string = "";
    objectType: UInt8 = ObjectType.None;
    nameStringId: StringId<Int16> = asInt16(-1);
    creationStringId: StringId<Int16> = asInt16(-1);
    objectClass: Int16 = ObjectClass.None;
    idleSpriteId: SpriteId<Int16> = asInt16(-1);
    deathSpriteId: SpriteId<Int16> = asInt16(-1);
    undeathSpriteId: SpriteId<Int16> = asInt16(-1);
    undead: Bool8 = asBool8(false);
    hitpoints: Int16 = asInt16(0);
    lineOfSight: Float32 = asFloat32(0);
    garrisonCapacity: UInt8 = asUInt8(0);
    collisionRadius: Point3D<Float32> = {
        x: asFloat32(0),
        y: asFloat32(0),
        z: asFloat32(0)
    }

    creationSoundId: SoundEffectId<Int16> = asInt16(-1);
    deadUnitId: PrototypeId<Int16> = asInt16(-1);
    sortNumber: UInt8 = asUInt8(0);
    canBeBuiltOn: UInt8 = asUInt8(0);
    iconNumber: Int16 = asInt16(-1);
    hiddenInEditor: Bool8 = asBool8(false);
    portraitPicture: Int16 = asInt16(-1); // obsolete(?)
    available: Bool8 = asBool8(true);
    placementNeighbouringTerrains: TerrainId<Int16>[] = [];
    placementUnderlyingTerrains: TerrainId<Int16>[] = [];
    clearanceSize: Point<Float32> = {
        x: asFloat32(0),
        y: asFloat32(0)
    };
    elevationMode: UInt8 = asUInt8(0);
    fogVisibility: UInt8 = asUInt8(0);
    habitat: HabitatId<Int16> = asInt16(-1); // this habitat is used for passability checks (e.g. bland unit or boat)
    flyMode: UInt8 = asUInt8(0);
    attributeCapacity: Int16 = asInt16(0);
    attributeDecayRate: Float32 = asFloat32(0);
    blastDefenseLevel: UInt8 = asUInt8(0);
    combatMode: UInt8 = asUInt8(0);
    interactionMode: UInt8 = asUInt8(0);
    minimapMode: UInt8 = asUInt8(0);
    interfaceType: UInt8 = asUInt8(0);
    multipleAttributeMode: Float32 = asFloat32(0);
    minimapColor: PaletteIndex = asUInt8(0);
    helpDialogStringId: StringId<Int32> = asInt32(-1); // The game actually only supports 16-bit string indexes, higher values will overflow
    helpPageStringId: StringId<Int32> = asInt32(-1);
    hotkeyStringId: StringId<Int32> = asInt32(-1);

    reusable: Bool8 = asBool8(false);
    trackAsResource: Bool8 = asBool8(false);
    doppelgangerMode: UInt8 = asUInt8(0);
    resourceGroup: UInt8 = asUInt8(0);

    selectionOutlineFlags: UInt8 = asUInt8(0); // 0x1 = Always show outline in editor; 0x2 = Don't show health bar
    editorSelectionOutlineColor: PaletteIndex = asUInt8(0);
    selectionOutlineRadius: Point3D<Float32> = {
        x: asFloat32(0),
        y: asFloat32(0),
        z: asFloat32(0)
    };
    attributesStored: AttributeStorage[] = [];
    damageSprites: DamageSprite[] = [];

    selectionSoundId: SoundEffectId<Int16> = asInt16(-1);
    deathSoundId: SoundEffectId<Int16> = asInt16(-1);
    attackReaction: UInt8 = asUInt8(0);
    convertTerrain: Bool8 = asBool8(false);
    upgradeUnitPrototypeId: PrototypeId<Int16> = asInt16(-1); // internal field, should definitely not be modified
    
    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        const nameLength = buffer.readInt16();
        this.id = buffer.readInt16();
        this.nameStringId = buffer.readInt16();
        this.creationStringId = buffer.readInt16();
        this.objectClass = buffer.readInt16();
        this.idleSpriteId = buffer.readInt16();
        this.deathSpriteId = buffer.readInt16();
        this.undeathSpriteId = buffer.readInt16();
        this.undead = buffer.readBool8();
        this.hitpoints = buffer.readInt16();
        this.lineOfSight = buffer.readFloat32();
        this.garrisonCapacity = buffer.readUInt8();
        this.collisionRadius = {
            x: buffer.readFloat32(),
            y: buffer.readFloat32(),
            z: buffer.readFloat32(),
        };
        this.creationSoundId = buffer.readInt16();
        this.deadUnitId = buffer.readInt16();
        this.sortNumber = buffer.readUInt8();
        this.canBeBuiltOn = buffer.readUInt8();
        this.iconNumber = buffer.readInt16();
        this.hiddenInEditor = buffer.readBool8();
        this.portraitPicture = buffer.readInt16();
        this.available = buffer.readBool8();
        
        // TODO: Filter based on load context
        const requiredNeighbouringTerrains: TerrainId<Int16>[] = [];
        this.placementNeighbouringTerrains = [];
        for (let i = 0; i < 2; ++i) {
            requiredNeighbouringTerrains.push(buffer.readInt16());
        }
        this.placementNeighbouringTerrains = requiredNeighbouringTerrains;

        const requiredUnderlyingTerrains: TerrainId<Int16>[] = [];
        this.placementUnderlyingTerrains = [];
        for (let i = 0; i < 2; ++i) {
            requiredUnderlyingTerrains.push(buffer.readInt16());
        }
        this.placementUnderlyingTerrains = requiredUnderlyingTerrains;

        this.clearanceSize = {
            x: buffer.readFloat32(),
            y: buffer.readFloat32()
        }
        this.elevationMode = buffer.readUInt8();
        this.fogVisibility = buffer.readUInt8();
        this.habitat = buffer.readInt16();

        this.flyMode = buffer.readUInt8();
        this.attributeCapacity = buffer.readInt16();
        this.attributeDecayRate = buffer.readFloat32();
        
        this.blastDefenseLevel = buffer.readUInt8();
        this.combatMode = buffer.readUInt8();
        this.interactionMode = buffer.readUInt8();

        this.minimapMode = buffer.readUInt8();
        this.interfaceType = buffer.readUInt8();

        this.multipleAttributeMode = buffer.readFloat32();
        this.minimapColor = buffer.readUInt8();

        this.helpDialogStringId = buffer.readInt32();
        this.helpPageStringId = buffer.readInt32();
        this.hotkeyStringId = buffer.readInt32();

        this.reusable = buffer.readBool8();
        this.trackAsResource = buffer.readBool8();
        this.doppelgangerMode = buffer.readUInt8();
        this.resourceGroup = buffer.readUInt8();

        this.selectionOutlineFlags = buffer.readUInt8();
        this.editorSelectionOutlineColor = buffer.readUInt8();
        this.selectionOutlineRadius = {
            x: buffer.readFloat32(),
            y: buffer.readFloat32(),
            z: buffer.readFloat32()
        };

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
                spriteId: buffer.readInt16(),
                damagePercent: buffer.readUInt8(),
                padding05: buffer.readUInt8(),
                applyMode: buffer.readUInt8()
            });
        }

        this.selectionSoundId = buffer.readInt16();
        this.deathSoundId = buffer.readInt16();
        this.attackReaction = buffer.readUInt8();
        this.convertTerrain = buffer.readBool8();

        this.internalName = nameLength > 0 ? buffer.readFixedSizeString(nameLength) : "";
        this.upgradeUnitPrototypeId = buffer.readInt16();

    }

}

