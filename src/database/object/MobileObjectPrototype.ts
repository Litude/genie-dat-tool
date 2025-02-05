import BufferReader from "../../BufferReader";
import { createReferenceString } from "../../json/reference-id";
import { OldJsonFieldConfig } from "../../json/json-serialization";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { Nullable } from "../../ts/ts-utils";
import { getDataEntry } from "../../util";
import { Habitat } from "../landscape/Habitat";
import { Overlay } from "../landscape/Overlay";
import { Terrain } from "../landscape/Terrain";
import { LoadingContext } from "../LoadingContext";
import { Technology } from "../research/Technology";
import { SavingContext } from "../SavingContext";
import { SoundEffect } from "../SoundEffect";
import { Sprite } from "../Sprite";
import { PrototypeId, SpriteId } from "../Types";
import { asFloat32, asInt16, asUInt8, Float32, Int16, UInt8 } from "../../ts/base-types";
import { AnimatedObjectPrototype } from "./AnimatedObjectPrototype";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

const jsonFields: OldJsonFieldConfig<MobileObjectPrototype>[] = [
    { field: "walkingSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.walkingSprite?.referenceId, obj.walkingSpriteId) },
    { field: "runningSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.runningSprite?.referenceId, obj.runningSpriteId) },
    { field: "rotationSpeed" },
    { field: "sizeClass", flags: { unusedField: true } },
    { field: "trailingUnitPrototypeId", toJson: (obj) => createReferenceString("ObjectPrototype", obj.trailingUnitPrototype?.referenceId, obj.trailingUnitPrototypeId) },
    { field: "trailingUnitMode" },
    { field: "trailingUnitDensity" },
    { field: "moveAlgorithm", flags: { unusedField: true } },
]

export class MobileObjectPrototype extends AnimatedObjectPrototype {
    walkingSpriteId: SpriteId<Int16> = asInt16(-1);
    walkingSprite: Sprite | null = null;
    runningSpriteId: SpriteId<Int16> = asInt16(-1);
    runningSprite: Sprite | null = null;
    rotationSpeed: Float32 = asFloat32(0);
    sizeClass: UInt8 = asUInt8(0); // obsolete?
    trailingUnitPrototypeId: PrototypeId<Int16> = asInt16(-1);
    trailingUnitPrototype: SceneryObjectPrototype | null = null;
    trailingUnitMode: UInt8 = asUInt8(0);
    trailingUnitDensity: Float32 = asFloat32(0);
    moveAlgorithm: UInt8 = asUInt8(0); // obsolete?
    
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.walkingSpriteId = buffer.readInt16();
        this.runningSpriteId = buffer.readInt16();
        this.rotationSpeed = buffer.readFloat32();
        this.sizeClass = buffer.readUInt8();
        this.trailingUnitPrototypeId = buffer.readInt16();
        this.trailingUnitMode = buffer.readUInt8();
        this.trailingUnitDensity = buffer.readFloat32();
        this.moveAlgorithm = buffer.readUInt8();
    }
        
    linkOtherData(
        sprites: Nullable<Sprite>[], soundEffects: Nullable<SoundEffect>[], terrains: Nullable<Terrain>[], habitats: Nullable<Habitat>[],
        objects: Nullable<SceneryObjectPrototype>[], technologies: Nullable<Technology>[], overlays: Nullable<Overlay>[], loadingContext: LoadingContext
    ) {
        super.linkOtherData(sprites, soundEffects, terrains, habitats, objects, technologies, overlays, loadingContext);
        this.walkingSprite = getDataEntry(sprites, this.walkingSpriteId, "Sprite", this.referenceId, loadingContext);
        this.runningSprite = getDataEntry(sprites, this.runningSpriteId, "Sprite", this.referenceId, loadingContext);
        this.trailingUnitPrototype = getDataEntry(objects, this.trailingUnitPrototypeId, "ObjectPrototype", this.referenceId, loadingContext);
    }
    
    getJsonConfig(): OldJsonFieldConfig<SceneryObjectPrototype>[] {
        return super.getJsonConfig().concat(jsonFields as OldJsonFieldConfig<SceneryObjectPrototype>[]);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext);
        textFileWriter
            .indent(4)
            .integer(this.walkingSpriteId)
            .integer(this.runningSpriteId)
            .float(this.rotationSpeed)
            .integer(this.sizeClass)
            .integer(this.trailingUnitPrototypeId)
            .integer(this.trailingUnitMode)
            .float(this.trailingUnitDensity)
            .integer(this.moveAlgorithm)
            .eol();
    }
}
