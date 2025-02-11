import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { AttributeId, PrototypeId, ReferenceStringSchema } from "../Types";
import { asInt16, asUInt8, Bool8, Bool8Schema, Int16, Int16Schema, UInt8, UInt8Schema } from "../../ts/base-types";
import { CombatantObjectPrototype, CombatantObjectPrototypeSchema } from "./CombatantObjectPrototype";
import { SceneryObjectPrototype } from './SceneryObjectPrototype';
import { JsonFieldMapping, transformJsonToObject, transformObjectToJson } from '../../json/json-serialization';
import { Nullable, trimEnd } from '../../ts/ts-utils';
import { Sprite } from '../Sprite';
import { SoundEffect } from '../SoundEffect';
import { Terrain } from '../landscape/Terrain';
import { Habitat } from '../landscape/Habitat';
import { getDataEntry } from '../../util';
import { createReferenceString, getIdFromReferenceString } from '../../json/reference-id';
import { Technology } from '../research/Technology';
import { Overlay } from '../landscape/Overlay';
import { z } from 'zod';

interface ResourceCost {
    attributeId: AttributeId<Int16>;
    amount: Int16;
    costDeducted: Bool8; // todo: figure out what this really is...? 
    padding05: UInt8;
}

export const ResourceCostSchema = z.object({
    attributeId: Int16Schema,
    amount: Int16Schema,
    costDeducted: Bool8Schema,
});

type ResourceCostJson = z.infer<typeof ResourceCostSchema>;

const ResourceCostJsonMapping: JsonFieldMapping<ResourceCost, ResourceCostJson>[] = [
    { field: "attributeId" },
    { field: "amount" },
    { field: "costDeducted" },
    { objectField: "padding05", fromJson: () => asUInt8(0) },
];

export const AdvancedCombatantObjectPrototypeSchema = CombatantObjectPrototypeSchema.merge(z.object({
    resourceCosts: z.array(ResourceCostSchema).max(3),
    creationDuration: Int16Schema,
    creationLocationPrototypeId: ReferenceStringSchema,
    creationButtonIndex: UInt8Schema,
    originalPierceArmorValue: Int16Schema.optional(),
}))

type AdvancedCombatantObjectPrototypeJson = z.infer<typeof AdvancedCombatantObjectPrototypeSchema>;

const AdvancedCombatantObjectPrototypeJsonMapping: JsonFieldMapping<AdvancedCombatantObjectPrototype, AdvancedCombatantObjectPrototypeJson>[] = [
    { jsonField: "resourceCosts",
        toJson: (obj) => trimEnd(obj.resourceCosts, cost => cost.attributeId === -1).map(cost => ({
            attributeId: cost.attributeId,
            amount: cost.amount,
            costDeducted: cost.costDeducted,
        }))},
    { objectField: "resourceCosts", fromJson: (json, obj, loadingContext) => json.resourceCosts.map(resourceCost => transformJsonToObject(resourceCost, ResourceCostJsonMapping, loadingContext)) },
    { field: "creationDuration" },
    { jsonField: "creationLocationPrototypeId", toJson: (obj) => createReferenceString("ObjectPrototype", obj.creationLocationPrototype?.referenceId, obj.creationLocationPrototypeId ) },
    { objectField: "creationLocationPrototypeId", fromJson: (json, obj, loadingContext) => getIdFromReferenceString<PrototypeId<Int16>>("ObjectPrototype", obj.referenceId, json.creationLocationPrototypeId, loadingContext.dataIds.prototypeIds) },
    { field: "creationButtonIndex" },
    { field: "originalPierceArmorValue", versionFrom: "3.2.0" }
]

export class AdvancedCombatantObjectPrototype extends CombatantObjectPrototype {
    resourceCosts: ResourceCost[] = [];
    creationDuration: Int16 = asInt16(0);
    creationLocationPrototypeId: PrototypeId<Int16> = asInt16<PrototypeId<Int16>>(-1);
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
        this.creationLocationPrototypeId = buffer.readInt16<PrototypeId<Int16>>();
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
            
    toJson(savingContext: SavingContext) {
        return {
            ...super.toJson(savingContext),
            ...transformObjectToJson(this, AdvancedCombatantObjectPrototypeJsonMapping, savingContext)
        }
    }

}
