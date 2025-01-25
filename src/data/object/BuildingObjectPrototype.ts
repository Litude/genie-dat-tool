import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { asBool8, asInt16, asUInt8, Bool8, Int16, OverlayId, PrototypeId, SoundEffectId, SpriteId, TechnologyId, TerrainId, UInt8 } from "../Types";
import { AdvancedCombatantObjectPrototype } from "./AdvancedCombatantObjectPrototype";

export class BuildingObjectPrototype extends AdvancedCombatantObjectPrototype {
    constructionSpriteId: SpriteId<Int16> = asInt16(-1);
    adjacentConnectionMode: Bool8 = asBool8(false);
    graphicsOffset: Int16 = asInt16(0); // TODO: Is this the same offset for both the icon graphic and the drawn graphic?
    removeWhenBuilt: UInt8 = asUInt8(0);
    createdObjectWhenBuilt: PrototypeId<Int16> = asInt16(-1); // this was probably meant to be combined with the above flag so a unit is created when building is finished and the building itself is removed (not removing the building causes bugs such as the unit being created again when loading a game)
    changedTerrainWhenBuilt: TerrainId<Int16> = asInt16(-1); // changes terrain when building is completed
    placedOverlayWhenBuilt: OverlayId<Int16> = asInt16(-1); // presumably the Build-Road object would remove itself when finished and place an overlay tile of road
    researchedTechnologyWhenBuilt: TechnologyId<Int16> = asInt16(-1); // most buildings unlock some kind of "shadow" technology when built such as enabling its units to be created
    constructionSoundEffectId: SoundEffectId<Int16> = asInt16(-1);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);

        this.constructionSpriteId = buffer.readInt16();
        this.adjacentConnectionMode = buffer.readBool8();
        this.graphicsOffset = buffer.readInt16();
        this.removeWhenBuilt = buffer.readUInt8();
        this.createdObjectWhenBuilt = buffer.readInt16();
        this.changedTerrainWhenBuilt = buffer.readInt16();
        this.placedOverlayWhenBuilt = buffer.readInt16();
        this.researchedTechnologyWhenBuilt = buffer.readInt16();
        this.constructionSoundEffectId = buffer.readInt16();
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext)
        textFileWriter
            .indent(4)
            .integer(this.constructionSpriteId)
            .integer(this.adjacentConnectionMode ? 1 : 0)
            .integer(this.graphicsOffset)
            .integer(this.removeWhenBuilt)
            .integer(this.createdObjectWhenBuilt)
            .integer(this.changedTerrainWhenBuilt)
            .integer(this.placedOverlayWhenBuilt)
            .integer(this.researchedTechnologyWhenBuilt)
            .integer(this.constructionSoundEffectId)
            .eol();
    }
}
