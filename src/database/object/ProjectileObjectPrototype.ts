import BufferReader from "../../BufferReader";
import {
  applyJsonFieldsToObject,
  JsonFieldMapping,
  transformObjectToJson,
} from "../../json/json-serialization";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { DatLoadingContext, JsonLoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import {
  asFloat32,
  asUInt8,
  Float32,
  Float32Schema,
  Int16,
  UInt8,
  UInt8Schema,
} from "../../ts/base-types";
import {
  CombatantObjectPrototype,
  CombatantObjectPrototypeSchema,
} from "./CombatantObjectPrototype";
import { z } from "zod";
import { PrototypeId } from "../Types";

export const ProjectileObjectPrototypeSchema =
  CombatantObjectPrototypeSchema.merge(
    z.object({
      projectileType: UInt8Schema,
      targettingMode: UInt8Schema,
      hitMode: UInt8Schema,
      vanishMode: UInt8Schema,
      areaEffect: UInt8Schema,
      projectileArc: Float32Schema,
    }),
  );

type ProjectileObjectPrototypeJson = z.infer<
  typeof ProjectileObjectPrototypeSchema
>;

const ProjectileObjectPrototypeJsonMapping: JsonFieldMapping<
  ProjectileObjectPrototype,
  ProjectileObjectPrototypeJson
>[] = [
  { field: "projectileType" },
  { field: "targettingMode" },
  { field: "hitMode" },
  { field: "vanishMode" },
  { field: "areaEffect" },
  { field: "projectileArc" },
];

export class ProjectileObjectPrototype extends CombatantObjectPrototype {
  projectileType: UInt8 = asUInt8(0);
  targettingMode: UInt8 = asUInt8(0);
  hitMode: UInt8 = asUInt8(0);
  vanishMode: UInt8 = asUInt8(0);
  areaEffect: UInt8 = asUInt8(0);
  projectileArc: Float32 = asFloat32(0);

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    loadingContext: DatLoadingContext,
  ): void {
    super.readFromBuffer(buffer, id, loadingContext);
    this.projectileType = buffer.readUInt8();
    this.targettingMode = buffer.readUInt8();
    this.hitMode = buffer.readUInt8();
    this.vanishMode = buffer.readUInt8();
    this.areaEffect = buffer.readUInt8();
    this.projectileArc = buffer.readFloat32();
  }

  readFromJsonFile(
    jsonFile: ProjectileObjectPrototypeJson,
    id: PrototypeId<Int16>,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    super.readFromJsonFile(jsonFile, id, referenceId, loadingContext);
    applyJsonFieldsToObject(
      jsonFile,
      this,
      ProjectileObjectPrototypeJsonMapping,
      loadingContext,
    );
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    savingContext: SavingContext,
  ): void {
    super.appendToTextFile(textFileWriter, savingContext);
    textFileWriter
      .indent(4)
      .integer(this.projectileType)
      .integer(this.targettingMode)
      .integer(this.hitMode)
      .integer(this.vanishMode)
      .integer(this.areaEffect)
      .float(this.projectileArc)
      .eol();
  }

  toJson(savingContext: SavingContext) {
    return {
      ...super.toJson(savingContext),
      ...transformObjectToJson(
        this,
        ProjectileObjectPrototypeJsonMapping,
        savingContext,
      ),
    };
  }
}
