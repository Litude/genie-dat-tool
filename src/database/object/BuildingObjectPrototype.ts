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
import { asBool8, asInt16, asUInt8, Bool8, Int16, OverlayId, PrototypeId, SoundEffectId, SpriteId, TechnologyId, TerrainId, UInt8 } from "../Types";
import { AdvancedCombatantObjectPrototype } from "./AdvancedCombatantObjectPrototype";
import { SceneryObjectPrototype } from "./SceneryObjectPrototype";

const jsonFields: OldJsonFieldConfig<BuildingObjectPrototype>[] = [
    { field: "constructionSpriteId", toJson: (obj) => createReferenceString("Sprite", obj.constructionSprite?.referenceId, obj.constructionSpriteId) },
    { field: "adjacentConnectionMode" },
    { field: "graphicsOffset" },
    { field: "removeWhenBuilt" },
    { field: "createdObjectIdWhenBuilt", toJson: (obj) => createReferenceString("ObjectPrototype", obj.createdObjectWhenBuilt?.referenceId, obj.createdObjectIdWhenBuilt) },
    { field: "changedTerrainIdWhenBuilt", toJson: (obj) => createReferenceString("Terrain", obj.changedTerrainWhenBuilt?.referenceId, obj.changedTerrainIdWhenBuilt) },
    { field: "placedOverlayIdWhenBuilt", toJson: (obj) => createReferenceString("Overlay", obj.placedOverlayWhenBuilt?.referenceId, obj.placedOverlayIdWhenBuilt )},
    { field: "researchedTechnologyIdWhenBuilt", toJson: (obj) => createReferenceString("Technology", obj.researchedTechnologyWhenBuilt?.referenceId, obj.researchedTechnologyIdWhenBuilt) },
    { field: "constructionSoundEffectId", toJson: (obj) => createReferenceString("SoundEffect", obj.constructionSoundEffect?.referenceId, obj.constructionSoundEffectId) },
]

export class BuildingObjectPrototype extends AdvancedCombatantObjectPrototype {
    constructionSpriteId: SpriteId<Int16> = asInt16(-1);
    constructionSprite: Sprite | null = null;
    adjacentConnectionMode: Bool8 = asBool8(false);
    graphicsOffset: Int16 = asInt16(0); // TODO: Is this the same offset for both the icon graphic and the drawn graphic?
    removeWhenBuilt: UInt8 = asUInt8(0);
    createdObjectIdWhenBuilt: PrototypeId<Int16> = asInt16(-1); // this was probably meant to be combined with the above flag so a unit is created when building is finished and the building itself is removed (not removing the building causes bugs such as the unit being created again when loading a game)
    createdObjectWhenBuilt: SceneryObjectPrototype | null = null;
    changedTerrainIdWhenBuilt: TerrainId<Int16> = asInt16(-1); // changes terrain when building is completed
    changedTerrainWhenBuilt: Terrain | null = null;
    placedOverlayIdWhenBuilt: OverlayId<Int16> = asInt16(-1); // presumably the Build-Road object would remove itself when finished and place an overlay tile of road
    placedOverlayWhenBuilt: Overlay | null = null;
    researchedTechnologyIdWhenBuilt: TechnologyId<Int16> = asInt16(-1); // most buildings unlock some kind of "shadow" technology when built such as enabling its units to be created
    researchedTechnologyWhenBuilt: Technology | null = null;
    constructionSoundEffectId: SoundEffectId<Int16> = asInt16(-1);
    constructionSoundEffect: SoundEffect | null = null;

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);

        this.constructionSpriteId = buffer.readInt16();
        this.adjacentConnectionMode = buffer.readBool8();
        this.graphicsOffset = buffer.readInt16();
        this.removeWhenBuilt = buffer.readUInt8();
        this.createdObjectIdWhenBuilt = buffer.readInt16();
        this.changedTerrainIdWhenBuilt = buffer.readInt16();
        this.placedOverlayIdWhenBuilt = buffer.readInt16();
        this.researchedTechnologyIdWhenBuilt = buffer.readInt16();
        this.constructionSoundEffectId = buffer.readInt16();
    }
        
    linkOtherData(
        sprites: Nullable<Sprite>[], soundEffects: Nullable<SoundEffect>[], terrains: Nullable<Terrain>[], habitats: Nullable<Habitat>[],
        objects: Nullable<SceneryObjectPrototype>[], technologies: Nullable<Technology>[], overlays: Nullable<Overlay>[], loadingContext: LoadingContext
    ) {
        super.linkOtherData(sprites, soundEffects, terrains, habitats, objects, technologies, overlays, loadingContext);
        this.constructionSprite = getDataEntry(sprites, this.constructionSpriteId, "Sprite", this.referenceId, loadingContext);
        this.createdObjectWhenBuilt = getDataEntry(objects, this.createdObjectIdWhenBuilt, "ObjectPrototype", this.referenceId, loadingContext);
        this.changedTerrainWhenBuilt = getDataEntry(terrains, this.changedTerrainIdWhenBuilt, "Terrain", this.referenceId, loadingContext);
        this.placedOverlayWhenBuilt = getDataEntry(overlays, this.placedOverlayIdWhenBuilt, "Overlay", this.referenceId, loadingContext);
        this.researchedTechnologyWhenBuilt = getDataEntry(technologies, this.researchedTechnologyIdWhenBuilt, "Technology", this.referenceId, loadingContext);
        this.constructionSoundEffect = getDataEntry(soundEffects, this.constructionSoundEffectId, "SoundEffect", this.referenceId, loadingContext);
    }
    
    getJsonConfig(): OldJsonFieldConfig<SceneryObjectPrototype>[] {
        return super.getJsonConfig().concat(jsonFields as OldJsonFieldConfig<SceneryObjectPrototype>[]);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext)
        textFileWriter
            .indent(4)
            .integer(this.constructionSpriteId)
            .integer(this.adjacentConnectionMode ? 1 : 0)
            .integer(this.graphicsOffset)
            .integer(this.removeWhenBuilt)
            .integer(this.createdObjectIdWhenBuilt)
            .integer(this.changedTerrainIdWhenBuilt)
            .integer(this.placedOverlayIdWhenBuilt)
            .integer(this.researchedTechnologyIdWhenBuilt)
            .integer(this.constructionSoundEffectId)
            .eol();
    }
}
