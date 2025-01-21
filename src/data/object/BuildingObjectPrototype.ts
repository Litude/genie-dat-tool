import BufferReader from "../../BufferReader";
import { LoadingContext } from "../LoadingContext";
import { asBool8, asInt16, asUInt8, Bool8, Int16, OverlayId, PrototypeId, SoundEffectId, SpriteId, TechnologyId, TerrainId, UInt8 } from "../Types";
import { AdvancedCombatantObjectPrototype } from "./AdvancedCombatantObjectPrototype";

export class BuildingObjectPrototype extends AdvancedCombatantObjectPrototype {
    constructionSpriteId: SpriteId<Int16> = asInt16(-1);
    adjacentConnectionMode: Bool8 = asBool8(false);
    graphicsOffset: Int16 = asInt16(0); // TODO: Is this the same offset for both the icon graphic and the drawn graphic?
    removeWhenBuilt: UInt8 = asUInt8(0);
    createObjectWhenBuilt: PrototypeId<Int16> = asInt16(-1); // this was probably meant to be combined with the above flag so a unit is created when building is finished and the building itself is removed (not removing the building causes bugs such as the unit being created again when loading a game)
    changeTerrainWhenBuilt: TerrainId<Int16> = asInt16(-1); // changes terrain when building is completed
    placeOverlayWhenBuilt: OverlayId<Int16> = asInt16(-1); // presumably the Build-Road object would remove itself when finished and place an overlay tile of road
    researchTechnologyWhenBuilt: TechnologyId<Int16> = asInt16(-1); // most buildings unlock some kind of "shadow" technology when built such as enabling its units to be created
    constructionSoundEffectId: SoundEffectId<Int16> = asInt16(-1);

    readFromBuffer(buffer: BufferReader, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, loadingContext);

        this.constructionSpriteId = buffer.readInt16();
        this.adjacentConnectionMode = buffer.readBool8();
        this.graphicsOffset = buffer.readInt16();
        this.removeWhenBuilt = buffer.readUInt8();
        this.createObjectWhenBuilt = buffer.readInt16();
        this.changeTerrainWhenBuilt = buffer.readInt16();
        this.placeOverlayWhenBuilt = buffer.readInt16();
        this.researchTechnologyWhenBuilt = buffer.readInt16();
        this.constructionSoundEffectId = buffer.readInt16();
    }
}
