import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { AttributeId, PrototypeId } from "../Types";
import { asInt16, asUInt8, Bool8, Int16, UInt8 } from "../../ts/base-types";
import { CombatantObjectPrototype } from "./CombatantObjectPrototype";
import { SceneryObjectPrototype } from './SceneryObjectPrototype';
import { OldJsonFieldConfig } from '../../json/json-serialization';
import { Nullable, trimEnd } from '../../ts/ts-utils';
import { Sprite } from '../Sprite';
import { SoundEffect } from '../SoundEffect';
import { Terrain } from '../landscape/Terrain';
import { Habitat } from '../landscape/Habitat';
import { getDataEntry } from '../../util';
import { createReferenceString } from '../../json/reference-id';
import { Technology } from '../research/Technology';
import { Overlay } from '../landscape/Overlay';

interface ResourceCost {
    attributeId: AttributeId<Int16>;
    amount: Int16;
    costDeducted: Bool8; // todo: figure out what this really is...? 
    padding05: UInt8;
}

const jsonFields: OldJsonFieldConfig<AdvancedCombatantObjectPrototype>[] = [
    { field: "resourceCosts",
        toJson: (obj) => trimEnd(obj.resourceCosts, cost => cost.attributeId === -1).map(cost => ({
            attributeId: cost.attributeId,
            amount: cost.amount,
            costDeducted: cost.costDeducted,
        }))},
    { field: "creationDuration" },
    { field: "creationLocationPrototypeId", toJson: (obj, savingContext) => createReferenceString("ObjectPrototype", obj.creationLocationPrototype?.referenceId, obj.creationLocationPrototypeId ), },
    { field: "creationButtonIndex" },
    { field: "originalPierceArmorValue", versionFrom: "3.2.0" }
]

export class AdvancedCombatantObjectPrototype extends CombatantObjectPrototype {
    resourceCosts: ResourceCost[] = [];
    creationDuration: Int16 = asInt16(0);
    creationLocationPrototypeId: PrototypeId<Int16> = asInt16(-1);
    creationLocationPrototype: SceneryObjectPrototype | null = null;
    creationButtonIndex: UInt8 = asUInt8(0);
    originalPierceArmorValue: Int16 = asInt16(0);

    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);

        this.resourceCosts = [];
        for (let i = 0; i < 3; ++i) {
            this.resourceCosts.push({
                attributeId: buffer.readInt16(),
                amount: buffer.readInt16(),
                costDeducted: buffer.readBool8(),
                padding05: buffer.readUInt8()
            });
        }
        this.creationDuration = buffer.readInt16();
        this.creationLocationPrototypeId = buffer.readInt16();
        this.creationButtonIndex = buffer.readUInt8();
        if (semver.gte(loadingContext.version.numbering, "3.2.0")) {
            this.originalPierceArmorValue = buffer.readInt16();
        }
        else {
            this.originalPierceArmorValue = asInt16(Math.max(0, ...this.armorTypes.filter(x => x.type === 3).map(x => x.amount)));
            this.originalArmorValue = asInt16(Math.max(this.baseArmor, ...this.armorTypes.filter(x => x.type !== 3).map(x => x.amount)));
        }
    }
    
    linkOtherData(
        sprites: Nullable<Sprite>[], soundEffects: Nullable<SoundEffect>[], terrains: Nullable<Terrain>[], habitats: Nullable<Habitat>[],
        objects: Nullable<SceneryObjectPrototype>[], technologies: Nullable<Technology>[], overlays: Nullable<Overlay>[], loadingContext: LoadingContext
    ) {
        super.linkOtherData(sprites, soundEffects, terrains, habitats, objects, technologies, overlays, loadingContext);
        this.creationLocationPrototype = getDataEntry(objects, this.creationLocationPrototypeId, "ObjectPrototype", this.referenceId, loadingContext);
    }
    
    getJsonConfig(): OldJsonFieldConfig<SceneryObjectPrototype>[] {
        return super.getJsonConfig().concat(jsonFields as OldJsonFieldConfig<SceneryObjectPrototype>[]);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext)
        textFileWriter
            .indent(4)

        for (let i = 0; i < 3; ++i) {
            const resourceCost = this.resourceCosts[i];
            textFileWriter
                .integer(resourceCost.attributeId)
                .integer(resourceCost.amount)
                .integer(resourceCost.costDeducted ? 1 : 0)
        }

        textFileWriter
            .integer(this.creationDuration)
            .integer(this.creationLocationPrototypeId)
            .integer(this.creationButtonIndex)
            .eol();
    }

}