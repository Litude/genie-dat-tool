import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import {
  asInt16,
  asInt32,
  asUInt8,
  Bool8,
  Int16,
  Int16Schema,
  Int32,
  Int32Schema,
  UInt8,
  UInt8Schema,
} from "../../ts/base-types";
import {
  AttributeId,
  PrototypeId,
  ReferenceStringSchema,
  StateEffectId,
  StringId,
  StringIdSchema,
  TechnologyId,
  TechnologyType,
  TechnologyTypeSchema,
} from "../Types";
import path from "path";
import {
  createReferenceString,
  createReferenceIdFromString,
  getIdFromReferenceString,
} from "../../json/reference-id";
import { SceneryObjectPrototype } from "../object/SceneryObjectPrototype";
import { StateEffect } from "./StateEffect";
import { getDataEntry } from "../../util";
import { isDefined, Nullable, trimEnd } from "../../ts/ts-utils";
import {
  applyJsonFieldsToObject,
  createJson,
  JsonFieldMapping,
  readJsonFileIndex,
  transformObjectToJson,
  writeDataEntriesToJson,
} from "../../json/json-serialization";
import { z } from "zod";
import { ResourceCostSchema } from "../object/AdvancedCombatantObjectPrototype";
import { readFileSync, writeFileSync } from "fs";

interface TechnologyResourceCost {
  attributeId: AttributeId<Int16>;
  amount: Int16;
  costDeducted: Bool8;
}

const TechnologySchema = z.object({
  internalName: z.string(),
  prerequisiteTechnologyIds: z.array(ReferenceStringSchema).max(4),
  resourceCosts: z.array(ResourceCostSchema).max(3),
  minimumPrerequisites: Int16Schema,
  researchLocationId: ReferenceStringSchema,
  nameStringId: StringIdSchema(Int16Schema).optional(),
  researchStringId: StringIdSchema(Int16Schema).optional(),
  researchDuration: Int16Schema,
  stateEffectId: ReferenceStringSchema,
  technologyType: TechnologyTypeSchema,
  iconNumber: Int16Schema,
  researchButtonIndex: UInt8Schema,
  helpDialogStringId: StringIdSchema(Int32Schema).optional(),
  helpPageStringId: StringIdSchema(Int32Schema).optional(),
  hotkeyStringId: StringIdSchema(Int32Schema).optional(),
});
type TechnologyJson = z.infer<typeof TechnologySchema>;

const TechnologyJsonMapping: JsonFieldMapping<Technology, TechnologyJson>[] = [
  { field: "internalName" },
  {
    jsonField: "prerequisiteTechnologyIds",
    toJson: (obj) => {
      return obj.prerequisiteTechnologies
        .slice(
          0,
          trimEnd(obj.prerequisiteTechnologyIds, (entry) => entry === -1)
            .length,
        )
        .map((entry, index) =>
          createReferenceString(
            "Technology",
            entry?.referenceId,
            obj.prerequisiteTechnologyIds[index],
          ),
        );
    },
  },
  {
    objectField: "prerequisiteTechnologyIds",
    fromJson: (json, obj, loadingContext) =>
      json.prerequisiteTechnologyIds.map((entry) =>
        getIdFromReferenceString<TechnologyId<Int16>>(
          "Technology",
          obj.referenceId,
          entry,
          loadingContext.dataIds.technologyIds,
        ),
      ),
  },
  {
    jsonField: "resourceCosts",
    toJson: (obj) =>
      trimEnd(obj.resourceCosts, (entry) => entry.attributeId === -1),
  },
  {
    objectField: "resourceCosts",
    fromJson: (json) => json.resourceCosts.map((entry) => ({ ...entry })),
  },
  { field: "minimumPrerequisites" },
  {
    jsonField: "researchLocationId",
    toJson: (obj) =>
      createReferenceString(
        "ObjectPrototype",
        obj.researchLocation?.referenceId,
        obj.researchLocationId,
      ),
  },
  {
    objectField: "researchLocationId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<PrototypeId<Int16>>(
        "ObjectPrototype",
        obj.referenceId,
        json.researchLocationId,
        loadingContext.dataIds.prototypeIds,
      ),
  },
  { field: "nameStringId", versionFrom: "1.5.0" },
  { field: "researchStringId", versionFrom: "1.5.0" },
  { field: "researchDuration" },
  {
    jsonField: "stateEffectId",
    toJson: (obj) =>
      createReferenceString(
        "StateEffect",
        obj.stateEffect?.referenceId,
        obj.stateEffectId,
      ),
  },
  {
    objectField: "stateEffectId",
    fromJson: (json, obj, loadingContext) =>
      getIdFromReferenceString<StateEffectId>(
        "StateEffect",
        obj.referenceId,
        json.stateEffectId,
        loadingContext.dataIds.stateEffectIds,
      ),
  },
  { field: "technologyType" },
  { field: "iconNumber" },
  { field: "researchButtonIndex" },
  { field: "helpDialogStringId", versionFrom: "2.7.0" },
  { field: "helpPageStringId", versionFrom: "2.7.0" },
  { field: "hotkeyStringId", versionFrom: "2.7.0" },
];

export class Technology {
  referenceId: string = "";
  id: Int16 = asInt16(-1);
  internalName: string = "";
  prerequisiteTechnologyIds: TechnologyId<Int16>[] = [];
  prerequisiteTechnologies: (Technology | null)[] = [];
  resourceCosts: TechnologyResourceCost[] = [];
  minimumPrerequisites: Int16 = asInt16(0);
  researchLocationId: PrototypeId<Int16> = asInt16<PrototypeId<Int16>>(-1);
  researchLocation: SceneryObjectPrototype | null = null;
  nameStringId: StringId<Int16> = asInt16<StringId<Int16>>(-1);
  researchStringId: StringId<Int16> = asInt16<StringId<Int16>>(-1);
  researchDuration: Int16 = asInt16(0);
  stateEffectId: StateEffectId = asInt16<StateEffectId>(-1);
  stateEffect: StateEffect | null = null;
  technologyType: TechnologyType = asInt16<TechnologyType>(0); // used by old AI for tracking similar technologies
  iconNumber: Int16 = asInt16(0);
  researchButtonIndex: UInt8 = asUInt8(0);
  helpDialogStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1); // The game actually only supports 16-bit string indexes, higher values will overflow
  helpPageStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);
  hotkeyStringId: StringId<Int32> = asInt32<StringId<Int32>>(-1);

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    loadingContext: LoadingContext,
  ): void {
    this.id = id;
    this.prerequisiteTechnologyIds = [];
    for (let i = 0; i < 4; ++i) {
      this.prerequisiteTechnologyIds.push(
        buffer.readInt16<TechnologyId<Int16>>(),
      );
    }
    this.resourceCosts = [];
    for (let i = 0; i < 3; ++i) {
      this.resourceCosts.push({
        attributeId: buffer.readInt16(),
        amount: buffer.readInt16(),
        costDeducted: buffer.readBool8(),
      });
    }
    this.minimumPrerequisites = buffer.readInt16();
    this.researchLocationId = buffer.readInt16<PrototypeId<Int16>>();
    if (semver.gte(loadingContext.version.numbering, "1.5.0")) {
      this.nameStringId = buffer.readInt16<StringId<Int16>>();
      this.researchStringId = buffer.readInt16<StringId<Int16>>();
    } else {
      this.nameStringId = asInt16<StringId<Int16>>(-1);
      this.researchStringId = asInt16<StringId<Int16>>(-1);
    }
    this.researchDuration = buffer.readInt16();
    this.stateEffectId = buffer.readInt16<StateEffectId>();
    this.technologyType = buffer.readInt16<TechnologyType>();
    this.iconNumber = buffer.readInt16();
    this.researchButtonIndex = buffer.readUInt8();
    if (semver.gte(loadingContext.version.numbering, "2.7.0")) {
      this.helpDialogStringId = buffer.readInt32<StringId<Int32>>();
      this.helpPageStringId = buffer.readInt32<StringId<Int32>>();
      this.hotkeyStringId = buffer.readInt32<StringId<Int32>>();
    }
    this.internalName = buffer.readPascalString16();
    this.referenceId = createReferenceIdFromString(this.internalName);
  }

  readFromJsonFile(
    jsonFile: TechnologyJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    this.id = id;
    this.referenceId = referenceId;
    applyJsonFieldsToObject(
      jsonFile,
      this,
      TechnologyJsonMapping,
      loadingContext,
    );
  }

  isValid() {
    return this.internalName !== "";
  }

  linkOtherData(
    technologies: Nullable<Technology>[],
    objects: Nullable<SceneryObjectPrototype>[],
    stateEffects: Nullable<StateEffect>[],
    loadingContext: LoadingContext,
  ) {
    this.prerequisiteTechnologies = this.prerequisiteTechnologyIds.map(
      (technologyId) =>
        getDataEntry(
          technologies,
          technologyId,
          "Technology",
          this.referenceId,
          loadingContext,
        ),
    );
    this.researchLocation = getDataEntry(
      objects,
      this.researchLocationId,
      "ObjectPrototype",
      this.referenceId,
      loadingContext,
    );
    this.stateEffect = getDataEntry(
      stateEffects,
      this.stateEffectId,
      "StateEffect",
      this.referenceId,
      loadingContext,
    );
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    savingContext: SavingContext,
  ): void {
    textFileWriter
      .integer(this.id)
      .string(this.internalName, 31)
      .integer(this.minimumPrerequisites)
      .integer(this.researchDuration)
      .integer(this.stateEffectId)
      .integer(this.technologyType)
      .integer(this.iconNumber)
      .integer(this.researchButtonIndex)
      .integer(this.researchLocationId);

    for (let i = 0; i < 4; ++i) {
      textFileWriter.integer(
        this.prerequisiteTechnologyIds.at(i) ??
          asInt16<TechnologyId<Int16>>(-1),
      );
    }
    for (let i = 0; i < 3; ++i) {
      const cost = this.resourceCosts.at(i);
      if (cost) {
        textFileWriter
          .integer(cost.attributeId)
          .integer(cost.amount)
          .integer(cost.costDeducted ? 1 : 0);
      } else {
        textFileWriter.integer(-1).integer(0).integer(0);
      }
    }

    if (semver.gte(savingContext.version.numbering, "1.5.0")) {
      textFileWriter.integer(this.nameStringId).integer(this.researchStringId);
    }

    if (semver.gte(savingContext.version.numbering, "2.7.0")) {
      textFileWriter
        .integer(this.helpDialogStringId)
        .integer(this.helpPageStringId)
        .integer(this.hotkeyStringId);
    }

    textFileWriter.eol();
  }

  writeToJsonFile(directory: string, savingContext: SavingContext) {
    writeFileSync(
      path.join(directory, `${this.referenceId}.json`),
      createJson(this.toJson(savingContext)),
    );
  }

  toJson(savingContext: SavingContext) {
    return transformObjectToJson(this, TechnologyJsonMapping, savingContext);
  }
}

export function readTechnologiesFromBuffer(
  buffer: BufferReader,
  loadingContext: LoadingContext,
): Nullable<Technology>[] {
  const result: Nullable<Technology>[] = [];
  const technologyCount = buffer.readInt16();
  for (let i = 0; i < technologyCount; ++i) {
    const technology = new Technology();
    technology.readFromBuffer(buffer, asInt16(i), loadingContext);
    result.push(technology.isValid() ? technology : null);
  }

  return result;
}

export function writeTechnologiesToWorldTextFile(
  outputDirectory: string,
  technologies: Nullable<Technology>[],
  savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.Technologies),
  );
  textFileWriter.raw(technologies.length).eol(); // Total technology entries
  const validEntries = technologies.filter(isDefined);
  textFileWriter.raw(validEntries.length).eol(); // Entries that have data

  validEntries.forEach((entry) => {
    entry.appendToTextFile(textFileWriter, savingContext);
  });
  textFileWriter.close();
}

export function writeTechnologiesToJsonFiles(
  outputDirectory: string,
  technologies: Nullable<Technology>[],
  savingContext: SavingContext,
) {
  writeDataEntriesToJson(outputDirectory, "techs", technologies, savingContext);
}

export function readTechnologiesFromJsonFiles(
  inputDirectory: string,
  technologyIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const technologiesDirectory = path.join(inputDirectory, "techs");
  const technologies: Nullable<Technology>[] = [];
  technologyIds.forEach((technologyReferenceId, technologyNumberId) => {
    if (technologyReferenceId === null) {
      technologies.push(null);
    } else {
      const technologyJson = TechnologySchema.parse(
        JSON5.parse(
          readFileSync(
            path.join(technologiesDirectory, `${technologyReferenceId}.json`),
          ).toString("utf8"),
        ),
      );
      const technology = new Technology();
      technology.readFromJsonFile(
        technologyJson,
        asInt16(technologyNumberId),
        technologyReferenceId,
        loadingContext,
      );
      technologies.push(technology);
    }
  });
  return technologies;
}

export function readTechnologyIdsFromJsonIndex(inputDirectory: string) {
  return readJsonFileIndex(path.join(inputDirectory, "techs"));
}
