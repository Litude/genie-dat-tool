import semver from "semver";
import BufferReader from "../../BufferReader";
import { Point3D } from "../../geometry/Point";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asFloat32, asInt16, asUInt8, Float32, HabitatId, Int16, Percentage, PrototypeId, SpriteId, UInt8 } from "../Types";
import { ActorObjectPrototype } from "./ActorObjectPrototype";
import { JsonFieldConfig } from "../../json/json-serializer";
import { Habitat } from "../landscape/Habitat";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";
import { Sprite } from "../Sprite";
import { createReferenceString } from "../../json/filenames";
import { Nullable } from "../../ts/ts-utils";
import { SoundEffect } from "../SoundEffect";
import { Terrain } from "../landscape/Terrain";
import { getDataEntry } from "../../util";
import { Technology } from "../research/Technology";
import { Overlay } from "../landscape/Overlay";

interface DamageValue {
    type: Int16;
    amount: Int16;
}

const jsonFields: JsonFieldConfig<CombatantObjectPrototype>[] = [
    { key: "baseArmor" },
    { key: "attackTypes" },
    { key: "armorTypes" },
    { key: "bonusHabitat", transformTo: (obj) => createReferenceString("Habitat", obj.bonusHabitat?.referenceId, obj.bonusHabitatId) },
    { key: "maxRange" },
    { key: "blastRadius" },
    { key: "attackSpeed" },
    { key: "projectileUnitId", transformTo: (obj) => createReferenceString("ObjectPrototype", obj.projectileUnit?.referenceId, obj.projectileUnitId) },
    { key: "accuracy" },
    { key: "breakOffCombat", flags: { unusedField: true } },
    { key: "attackFrame" },
    { key: "projectileOffset", },
    { key: "blastAttackLevel" },
    { key: "minRange" },
    { key: "attackSpriteId", transformTo: (obj) => createReferenceString("Sprite", obj.attackSprite?.referenceId, obj.attackSpriteId ) },
    { key: "originalArmorValue", versionFrom: "3.2.0" },
    { key: "originalAttackValue", versionFrom: "3.2.0" },
    { key: "originalRangeValue", versionFrom: "3.2.0" },
    { key: "originalAttackSpeed", versionFrom: "3.2.0" },
]

export class CombatantObjectPrototype extends ActorObjectPrototype {
    baseArmor: UInt8 = asUInt8(0);
    attackTypes: DamageValue[] = [];
    armorTypes: DamageValue[] = [];
    bonusHabitatId: HabitatId<Int16> = asInt16(-1); // attack/defense values are multiplied based on this value
    bonusHabitat: Habitat | null = null;
    maxRange: Float32 = asFloat32(0);
    blastRadius: Float32 = asFloat32(0); // or is this diameter?
    attackSpeed: Float32 = asFloat32(0);
    projectileUnitId: PrototypeId<Int16> = asInt16(-1);
    projectileUnit: SceneryObjectPrototype | null = null;
    accuracy: Percentage<Int16> = asInt16(0);
    breakOffCombat: UInt8 = asUInt8(0); // obsolete?
    attackFrame: Int16 = asInt16(0); // is this only for projectiles?
    projectileOffset: Point3D<Float32> = {
        x: asFloat32(0),
        y: asFloat32(0),
        z: asFloat32(0)
    };
    blastAttackLevel: UInt8 = asUInt8(0);
    minRange: Float32 = asFloat32(0);
    attackSpriteId: SpriteId<Int16> = asInt16(-1);
    attackSprite: Sprite | null = null;
    originalArmorValue: Int16 = asInt16(0);
    originalAttackValue: Int16 = asInt16(0);
    originalRangeValue: Float32 = asFloat32(0);
    originalAttackSpeed: Float32 = asFloat32(0);
    
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.baseArmor = buffer.readUInt8();

        const attackTypeCount = buffer.readInt16();
        this.attackTypes = [];
        for (let i = 0; i < attackTypeCount; ++i) {
            this.attackTypes.push({
                type: buffer.readInt16(),
                amount: buffer.readInt16()
            });
        }
        const armorTypeCount = buffer.readInt16();
        this.armorTypes = [];
        for (let i = 0; i < armorTypeCount; ++i) {
            this.armorTypes.push({
                type: buffer.readInt16(),
                amount: buffer.readInt16()
            });
        }
        this.bonusHabitatId = buffer.readInt16();
        this.maxRange = buffer.readFloat32();
        this.blastRadius = buffer.readFloat32();
        this.attackSpeed = buffer.readFloat32();
        this.projectileUnitId = buffer.readInt16();
        this.accuracy = buffer.readInt16();
        this.breakOffCombat = buffer.readUInt8();
        this.attackFrame = buffer.readInt16();
        this.projectileOffset = {
            x: buffer.readFloat32(),
            y: buffer.readFloat32(),
            z: buffer.readFloat32()
        };
        this.blastAttackLevel = buffer.readUInt8();
        this.minRange = buffer.readFloat32();
        this.attackSpriteId = buffer.readInt16();
        if (semver.gte(loadingContext.version.numbering, "3.2.0")) {
            this.originalArmorValue = buffer.readInt16();
            this.originalAttackValue = buffer.readInt16();
            this.originalRangeValue = buffer.readFloat32();
            this.originalAttackSpeed = buffer.readFloat32();
        }
        else {
            this.originalArmorValue = asInt16(Math.max(this.baseArmor, ...this.armorTypes.map(x => x.amount)));
            this.originalAttackValue = asInt16(Math.max(0, ...this.attackTypes.map(x => x.amount)));
            this.originalRangeValue = this.maxRange;
            this.originalAttackSpeed = this.attackSpeed;
        }
    }
    
    linkOtherData(
        sprites: Nullable<Sprite>[], soundEffects: Nullable<SoundEffect>[], terrains: Nullable<Terrain>[], habitats: Nullable<Habitat>[],
        objects: Nullable<SceneryObjectPrototype>[], technologies: Nullable<Technology>[], overlays: Nullable<Overlay>[], loadingContext: LoadingContext
    ) {
        super.linkOtherData(sprites, soundEffects, terrains, habitats, objects, technologies, overlays, loadingContext);
        this.bonusHabitat = getDataEntry(habitats, this.bonusHabitatId, "Habitat", this.referenceId, loadingContext);
        this.projectileUnit = getDataEntry(objects, this.projectileUnitId, "ObjectPrototype", this.referenceId, loadingContext);
        this.attackSprite = getDataEntry(sprites, this.attackSpriteId, "Sprite", this.referenceId, loadingContext);
    }
    
    getJsonConfig(): JsonFieldConfig<SceneryObjectPrototype>[] {
        return super.getJsonConfig().concat(jsonFields as JsonFieldConfig<SceneryObjectPrototype>[]);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext);
        textFileWriter
            .indent(4)
            .integer(this.attackSpriteId)
            .integer(this.baseArmor)
            .integer(this.armorTypes.length)
            .integer(this.attackTypes.length)
            .integer(this.bonusHabitatId)
            .float(this.maxRange)
            .float(this.blastRadius)
            .float(this.attackSpeed)
            .integer(this.projectileUnitId)
            .integer(this.accuracy)
            .integer(this.breakOffCombat)
            .integer(this.attackFrame)
            .float(this.projectileOffset.x)
            .float(this.projectileOffset.y)
            .float(this.projectileOffset.z)
            .integer(this.blastAttackLevel)
            .float(this.minRange)
            .eol();

        [...this.armorTypes, ...this.attackTypes].forEach(damageType => {
            textFileWriter
                .indent(6)
                .integer(damageType.type)
                .integer(damageType.amount)
                .eol();
        })
    }
}
