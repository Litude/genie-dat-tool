import semver from 'semver';
import BufferReader from "../../BufferReader";
import { Point, Point3D } from "../../geometry/Point";
import { Logger } from "../../Logger";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asBool8, asFloat32, asInt16, asInt32, asUInt8, AttributeId, Bool8, Float32, HabitatId, Int16, Int32, PaletteIndex, PrototypeId, SoundEffectId, SpriteId, StringId, TerrainId, UInt8 } from "../Types";
import { ObjectClasses } from "./ObjectClass";
import { ObjectType, ObjectTypes } from "./ObjectType";

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

export class SceneryObjectPrototype {
    id: PrototypeId<Int16> = asInt16(-1);
    internalName: string = "";
    objectType: ObjectType = ObjectTypes.None;
    nameStringId: StringId<Int16> = asInt16(-1);
    creationStringId: StringId<Int16> = asInt16(-1);
    objectClass: Int16 = ObjectClasses.None;
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
    
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        const nameLength = buffer.readInt16();
        this.id = buffer.readInt16();
        if (this.id !== id) {
            Logger.warn(`Mismatch between stored Object id ${this.id} and ordering ${id}, data might be corrupt!`);
        }
        this.nameStringId = buffer.readInt16();
        if (semver.gte(loadingContext.version.numbering, "1.5.0")) {
            this.creationStringId = buffer.readInt16();
        }
        else {
            this.creationStringId = asInt16(-1);
        }
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

        if (semver.gte(loadingContext.version.numbering, "1.4.0")) {
            const requiredUnderlyingTerrains: TerrainId<Int16>[] = [];
            this.placementUnderlyingTerrains = [];
            for (let i = 0; i < 2; ++i) {
                requiredUnderlyingTerrains.push(buffer.readInt16());
            }
            this.placementUnderlyingTerrains = requiredUnderlyingTerrains;
        }
        else {
            this.placementUnderlyingTerrains = [asInt16(-1), asInt16(-1)];
        }

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

        if (semver.gte(loadingContext.version.numbering, "2.7.0")) {
            this.helpDialogStringId = buffer.readInt32();
            this.helpPageStringId = buffer.readInt32();
            this.hotkeyStringId = buffer.readInt32();
            this.reusable = buffer.readBool8();
        }
        else {
            this.helpDialogStringId = asInt32(this.nameStringId >= 5000 ? this.nameStringId + 100000 : 0);
            this.helpPageStringId = asInt32(this.nameStringId >= 5000 ? this.nameStringId + 150000 : 0);
            this.hotkeyStringId = asInt32(this.nameStringId >= 5000 && this.creationStringId > 0 ? this.nameStringId + 11001 : 0);
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
            this.editorSelectionOutlineColor = buffer.readUInt8();
            this.selectionOutlineRadius = {
                x: buffer.readFloat32(),
                y: buffer.readFloat32(),
                z: buffer.readFloat32()
            };
        }
        else {
            this.selectionOutlineFlags = asUInt8(0);
            this.editorSelectionOutlineColor = asUInt8(0);
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
        if (semver.gte(loadingContext.version.numbering, "3.5.0")) {
            this.upgradeUnitPrototypeId = buffer.readInt16();
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


    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext) {
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
            .integer(this.undeathSpriteId)
            .integer(this.undead ? 1 : 0)
            .integer(this.hitpoints)
            .float(this.lineOfSight)
            .integer(this.garrisonCapacity)
            .float(this.collisionRadius.x)
            .float(this.collisionRadius.y)
            .float(this.collisionRadius.z)
            .integer(this.deadUnitId)
            .integer(this.sortNumber)
            .integer(this.canBeBuiltOn)
            .integer(this.iconNumber)
            .integer(this.hiddenInEditor ? 1 : 0)
            .integer(this.portraitPicture)
            .integer(this.available ? 1 : 0)
            .eol()

        const outlineRadius = this.selectionOutlineRadius.x !== this.collisionRadius.x ||
            this.selectionOutlineRadius.y !== this.collisionRadius.y ||
            this.selectionOutlineRadius.z !== this.collisionRadius.z;

        textFileWriter
            .indent(4)
            .integer(this.placementNeighbouringTerrains[0])
            .integer(this.placementNeighbouringTerrains[1])
            .conditional(semver.gte(savingContext.version.numbering, "1.4.0"), writer => writer
                .integer(this.placementUnderlyingTerrains[0])
                .integer(this.placementUnderlyingTerrains[1])
            )
            .float(this.clearanceSize.x)
            .float(this.clearanceSize.y)
            .integer(this.elevationMode)
            .integer(this.fogVisibility)
            .integer(this.habitat)
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

}
