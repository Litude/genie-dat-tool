import semver from 'semver';
import BufferReader from "../../BufferReader";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import { AbilityId, asFloat32, asInt16, asUInt8, Float32, Int16, PrototypeId, SoundEffectId, UInt8 } from "../Types";
import { Ability } from "./Ability";
import { MobileObjectPrototype } from "./MobileObjectPrototype";
import { OldJsonFieldConfig, oldTransformObjectToJson } from '../../json/json-serialization';
import { SceneryObjectPrototype } from './SceneryObjectPrototype';
import { Nullable, trimEnd } from '../../ts/ts-utils';
import { createReferenceString } from '../../json/reference-id';
import { Sprite } from '../Sprite';
import { SoundEffect } from '../SoundEffect';
import { Terrain } from '../landscape/Terrain';
import { Habitat } from '../landscape/Habitat';
import { getDataEntry } from '../../util';
import { Technology } from '../research/Technology';
import { Overlay } from '../landscape/Overlay';

const jsonFields: OldJsonFieldConfig<ActorObjectPrototype>[] = [
    { field: "defaultAbility" },
    { field: "searchRadius" },
    { field: "workRate" },
    { field: "dropSitePrototypeIds", toJson: (obj) => {
        return obj.dropSitePrototypes
            .slice(0, trimEnd(obj.dropSitePrototypeIds, entry => entry === -1).length)
            .map((dropSite, index) => createReferenceString("ObjectPrototype", dropSite?.referenceId, obj.dropSitePrototypeIds[index]))
    }},
    { field: 'abilitySwapGroup' },
    { field: 'attackSoundId', toJson: (obj) => createReferenceString("SoundEffect", obj.attackSound?.referenceId, obj.attackSoundId) },
    { field: 'moveSoundId', toJson: (obj) => createReferenceString("SoundEffect", obj.moveSound?.referenceId, obj.moveSoundId) },
    { field: 'runPattern', flags: { unusedField: true } },
    { field: 'abilityList', toJson: (obj, savingContext) => obj.abilityList.map(ability => oldTransformObjectToJson(ability, ability.getJsonConfig(), savingContext)) },
]

export class ActorObjectPrototype extends MobileObjectPrototype {
    defaultAbility: AbilityId<Int16> = asInt16(-1);
    searchRadius: Float32 = asFloat32(0);
    workRate: Float32 = asFloat32(0);
    dropSitePrototypeIds: PrototypeId<Int16>[] = [];
    dropSitePrototypes: Nullable<SceneryObjectPrototype>[] = [];
    abilitySwapGroup: UInt8 = asUInt8(0);
    attackSoundId: SoundEffectId<Int16> = asInt16(-1);
    attackSound: SoundEffect | null = null;
    moveSoundId: SoundEffectId<Int16> = asInt16(-1);
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
            this.dropSitePrototypeIds.push(buffer.readInt16());
        }
        for (let i = this.dropSitePrototypeIds.length; i < 2; ++i) {
            this.dropSitePrototypeIds.push(asInt16(-1));
        }

        this.abilitySwapGroup = buffer.readUInt8();
        this.attackSoundId = buffer.readInt16();
        if (semver.gte(loadingContext.version.numbering, "3.1.1")) {
            this.moveSoundId = buffer.readInt16();
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
        
    getJsonConfig(): OldJsonFieldConfig<SceneryObjectPrototype>[] {
        return super.getJsonConfig().concat(jsonFields as OldJsonFieldConfig<SceneryObjectPrototype>[]);
    }

    writeToTextFile(textFileWriter: TextFileWriter, savingContext: SavingContext): void {
        super.writeToTextFile(textFileWriter, savingContext)
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
}
