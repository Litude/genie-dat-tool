import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { AbilityId, PrototypeId, ReferenceStringSchema, SoundEffectId } from "../Types";
import { asFloat32, asInt16, asUInt8, Float32, Float32Schema, Int16, Int16Schema, UInt8, UInt8Schema } from "../../ts/base-types";
import { Ability, AbilityJsonMapping, AbilitySchema } from "./Ability";
import { MobileObjectPrototype, MobileObjectPrototypeSchema } from "./MobileObjectPrototype";
import { applyJsonFieldsToObject, JsonFieldMapping, transformJsonToObject, transformObjectToJson } from '../../json/json-serialization';
import { SceneryObjectPrototype } from './SceneryObjectPrototype';
import { Nullable, trimEnd } from '../../ts/ts-utils';
import { createReferenceString, getIdFromReferenceString } from '../../json/reference-id';
import { Sprite } from '../Sprite';
import { SoundEffect } from '../SoundEffect';
import { Terrain } from '../landscape/Terrain';
import { Habitat } from '../landscape/Habitat';
import { getDataEntry } from '../../util';
import { Technology } from '../research/Technology';
import { Overlay } from '../landscape/Overlay';
import { z } from 'zod';

export const ActorObjectPrototypeSchema = MobileObjectPrototypeSchema.merge(z.object({
    defaultAbility: Int16Schema.optional(),
    searchRadius: Float32Schema,
    workRate: Float32Schema,
    dropSitePrototypeIds: z.array(ReferenceStringSchema).max(2),
    abilitySwapGroup: UInt8Schema,
    attackSoundId: ReferenceStringSchema,
    moveSoundId: ReferenceStringSchema.optional(),
    runPattern: UInt8Schema.optional(),
    abilityList: z.array(AbilitySchema)
}));

type ActorObjectPrototypeJson = z.infer<typeof ActorObjectPrototypeSchema>;

const ActorObjectPrototypeJsonMapping: JsonFieldMapping<ActorObjectPrototype, ActorObjectPrototypeJson>[] = [
    { field: "defaultAbility", flags: { internalField: true } }, // this should be specified for an ability and if multiple are specified, throw an error
    { field: "searchRadius" },
    { field: "workRate" },
    { jsonField: "dropSitePrototypeIds", toJson: (obj) => {
        return obj.dropSitePrototypes
            .slice(0, trimEnd(obj.dropSitePrototypeIds, entry => entry === -1).length)
            .map((dropSite, index) => createReferenceString("ObjectPrototype", dropSite?.referenceId, obj.dropSitePrototypeIds[index]))
    }},
    { objectField: "dropSitePrototypeIds", fromJson: (json, obj, loadingContext) => json.dropSitePrototypeIds.map(prototypeId => getIdFromReferenceString<PrototypeId<Int16>>("ObjectPrototype", obj.referenceId, prototypeId, loadingContext.dataIds.prototypeIds)) },
    { field: 'abilitySwapGroup' },
    { jsonField: 'attackSoundId', toJson: (obj) => createReferenceString("SoundEffect", obj.attackSound?.referenceId, obj.attackSoundId) },
    { objectField: 'attackSoundId', fromJson: (json, obj, loadingContext) => getIdFromReferenceString<SoundEffectId<Int16>>("SoundEffect", obj.referenceId, json.attackSoundId, loadingContext.dataIds.soundEffectIds) },
    { jsonField: 'moveSoundId', toJson: (obj) => createReferenceString("SoundEffect", obj.moveSound?.referenceId, obj.moveSoundId) },
    { objectField: 'moveSoundId', fromJson: (json, obj, loadingContext) => json.moveSoundId !== undefined ? getIdFromReferenceString<SoundEffectId<Int16>>("SoundEffect", obj.referenceId, json.moveSoundId, loadingContext.dataIds.soundEffectIds) : undefined },
    { field: 'runPattern', flags: { unusedField: true } },
    { jsonField: 'abilityList', toJson: (obj, savingContext) => obj.abilityList.map(ability => transformObjectToJson(ability, AbilityJsonMapping, savingContext)) },
    { objectField: "abilityList", fromJson: (json, obj, loadingContext) => json.abilityList.map(abilityJson => {
        const ability = new Ability();
        applyJsonFieldsToObject(abilityJson, ability, AbilityJsonMapping, loadingContext);
        return ability;
    })},
]

export class ActorObjectPrototype extends MobileObjectPrototype {
    defaultAbility: AbilityId<Int16> = asInt16(-1);
    searchRadius: Float32 = asFloat32(0);
    workRate: Float32 = asFloat32(0);
    dropSitePrototypeIds: PrototypeId<Int16>[] = [];
    dropSitePrototypes: Nullable<SceneryObjectPrototype>[] = [];
    abilitySwapGroup: UInt8 = asUInt8(0);
    attackSoundId: SoundEffectId<Int16> = asInt16<SoundEffectId<Int16>>(-1);
    attackSound: SoundEffect | null = null;
    moveSoundId: SoundEffectId<Int16> = asInt16<SoundEffectId<Int16>>(-1);
    moveSound: SoundEffect | null = null;
    runPattern: UInt8 = asUInt8(0);
    abilityList: Ability[] = [];
    
    readFromBuffer(buffer: BufferReader, id: Int16, loadingContext: LoadingContext): void {
        super.readFromBuffer(buffer, id, loadingContext);
        this.defaultAbility = buffer.readInt16();
        this.searchRadius = buffer.readFloat32();
        this.workRate = buffer.readFloat32();

        this.dropSitePrototypeIds = [];
        const dropSiteCount = semver.gte(loadingContext.version.numbering, "1.3.1") ? 2 : 1;
        for (let i = 0; i < dropSiteCount; ++i) {
            this.dropSitePrototypeIds.push(buffer.readInt16<PrototypeId<Int16>>());
        }
        for (let i = this.dropSitePrototypeIds.length; i < 2; ++i) {
            this.dropSitePrototypeIds.push(asInt16<PrototypeId<Int16>>(-1));
        }

        this.abilitySwapGroup = buffer.readUInt8();
        this.attackSoundId = buffer.readInt16<SoundEffectId<Int16>>();
        if (semver.gte(loadingContext.version.numbering, "3.1.1")) {
            this.moveSoundId = buffer.readInt16<SoundEffectId<Int16>>();
        }
        else {
            this.moveSoundId = this.attackSoundId;
        }
        this.runPattern = buffer.readUInt8();

        this.abilityList = [];
        const abilityCount = buffer.readInt16();
        for (let i = 0; i < abilityCount; ++i) {
            const ability = new Ability();
            ability.readFromBuffer(buffer, loadingContext);
            this.abilityList.push(ability);
        }
    }

    readFromJsonFile(jsonFile: ActorObjectPrototypeJson, id: PrototypeId<Int16>, referenceId: string, loadingContext: JsonLoadingContext) {
        super.readFromJsonFile(jsonFile, id, referenceId, loadingContext);
        applyJsonFieldsToObject(jsonFile, this, ActorObjectPrototypeJsonMapping, loadingContext);
        if (jsonFile.moveSoundId === undefined) {
            this.moveSoundId === this.attackSoundId;
        }
    }
    
    linkOtherData(
        sprites: Nullable<Sprite>[], soundEffects: Nullable<SoundEffect>[], terrains: Nullable<Terrain>[], habitats: Nullable<Habitat>[],
        objects: Nullable<SceneryObjectPrototype>[], technologies: Nullable<Technology>[], overlays: Nullable<Overlay>[], loadingContext: LoadingContext
    ) {
        super.linkOtherData(sprites, soundEffects, terrains, habitats, objects, technologies, overlays, loadingContext);
        this.dropSitePrototypes = this.dropSitePrototypeIds.map(prototypeId => getDataEntry(objects, prototypeId, "ObjectPrototype", this.referenceId, loadingContext));
        this.attackSound = getDataEntry(soundEffects, this.attackSoundId, "SoundEffect", this.referenceId, loadingContext);
        this.moveSound = getDataEntry(soundEffects, this.moveSoundId, "SoundEffect", this.referenceId, loadingContext);
        this.abilityList.forEach(ability => {
            ability.linkOtherData(this.referenceId, sprites, soundEffects, terrains, objects, loadingContext);
        })
    }

    appendToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.appendToTextFile(textFileWriter, savingContext)
        textFileWriter
            .indent(4)
            .float(this.searchRadius)
            .float(this.workRate)
            .integer(this.dropSitePrototypeIds[0])
            .conditional(semver.gte(savingContext.version.numbering, "1.3.1"), writer => writer.integer(this.dropSitePrototypeIds[1]))
            .integer(this.abilitySwapGroup)
            .integer(this.attackSoundId)
            .conditional(
                semver.gte(savingContext.version.numbering, "3.1.1"),
                writer => writer.integer(this.moveSoundId)
            )
            .integer(this.runPattern)
            .eol();
        
        textFileWriter
            .indent(4)
            .raw(this.abilityList.length)
            .eol();

        this.abilityList.forEach(ability => {
            ability.writeToTextFile(textFileWriter, savingContext);
        })
    }
            
    toJson(savingContext: SavingContext) {
        return {
            ...super.toJson(savingContext),
            ...transformObjectToJson(this, ActorObjectPrototypeJsonMapping, savingContext)
        }
    }
}
