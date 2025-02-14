import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../BufferReader";
import { TextFileNames } from "../textfile/TextFile";
import { TextFileWriter } from "../textfile/TextFileWriter";
import { JsonLoadingContext, LoadingContext } from "./LoadingContext";
import { ObjectClass, ObjectClassSchema } from "./object/ObjectClass";
import { SavingContext } from "./SavingContext";
import {
  asBool16,
  asBool8,
  asFloat32,
  asInt16,
  asInt32,
  asUInt16,
  asUInt32,
  asUInt8,
  Bool16,
  Bool8,
  Float32,
  Int16,
  Int16Schema,
  Int32,
  NullPointer,
  Pointer,
  UInt16,
  UInt32,
  UInt8,
  UInt8Schema,
} from "../ts/base-types";
import {
  AgeId,
  Percentage,
  PrototypeId,
  ReferenceStringSchema,
  TechnologyType,
  TechnologyTypeSchema,
} from "./Types";
import path from "path";
import {
  applyJsonFieldsToObject,
  createJson,
  JsonFieldMapping,
  readJsonFileIndex,
  transformJsonToObject,
  transformObjectToJson,
  writeDataEntriesToJson,
} from "../json/json-serialization";
import { Nullable } from "../ts/ts-utils";
import {
  createReferenceIdFromString,
  createReferenceString,
  getIdFromReferenceString,
} from "../json/reference-id";
import { BaseObjectPrototype } from "./object/ObjectPrototypes";
import { getDataEntry } from "../util";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";

// Many entries have exactly 8 entries in an array... Perhaps these correspond to 1 for each age in very early stages of development when there were 8 ages
// For exampla the object state type as 8 entries for target units and target percents, perhaps to allow specifying how many of that unit the AI should
// have when at a specific age

interface AiGroup {
  targetPercents: Percentage<Int16>[];
  assetsTotal: Int32;
  deltaPercent: Percentage<Int16>;
  padding16: UInt16;
}
const AiGroupSchema = z.object({
  targetPercents: z.array(Int16Schema).length(8),
});
type AiGroupJson = z.infer<typeof AiGroupSchema>;

const AiGroupJsonMapping: JsonFieldMapping<AiGroup, AiGroupJson>[] = [
  { field: "targetPercents" },
  { objectField: "assetsTotal", fromJson: () => asInt32(0) },
  { objectField: "deltaPercent", fromJson: () => asInt16(0) },
  { objectField: "padding16", fromJson: () => asInt16(0) },
];

interface AiObjectGoal {
  targetCounts: Int16[];
  targetPercents: Percentage<Int16>[];
  prototypeId: PrototypeId<Int16>;
  prototype: BaseObjectPrototype | null;
  objectClass: ObjectClass;
  aiGroupId: Int16;
  objectCount: Int16;
  assetsTotal: Int32;
  deltaPercent: Percentage<Int16>;
  stateName: string;
  padding43: UInt8;
}
const AiObjectGoalSchema = z.object({
  targetCounts: z.array(Int16Schema).length(8),
  targetPercents: z.array(Int16Schema).length(8),
  prototypeId: ReferenceStringSchema,
  objectClass: ObjectClassSchema,
  aiGroupId: Int16Schema,
  stateName: z.string(),
});
type AiObjectGoalJson = z.infer<typeof AiObjectGoalSchema>;
const AiObjectGoalJsonMapping: JsonFieldMapping<
  AiObjectGoal,
  AiObjectGoalJson
>[] = [
  { field: "targetCounts" },
  { field: "targetPercents" },
  {
    jsonField: "prototypeId",
    toJson: (obj) =>
      createReferenceString(
        "ObjectPrototype",
        obj.prototype?.referenceId,
        obj.prototypeId,
      ),
  },
  {
    objectField: "prototypeId",
    fromJson: (json, _obj, loadingContext) =>
      getIdFromReferenceString<PrototypeId<Int16>>(
        "ObjectPrototype",
        "TribeAi",
        json.prototypeId,
        loadingContext.dataIds.prototypeIds,
      ),
  },
  { field: "objectClass" },
  { field: "aiGroupId" },
  { objectField: "objectCount", fromJson: () => asInt16(0) },
  { objectField: "assetsTotal", fromJson: () => asInt32(0) },
  { objectField: "deltaPercent", fromJson: () => asInt16(0) },
  { field: "stateName" },
  { objectField: "padding43", fromJson: () => asUInt8(0) },
];

interface AiTechnologyGoal {
  targetPercents: Percentage<Int16>[];
  technologyType: TechnologyType; // this references the "unused" value in techonlogies
  padding12: UInt16;
  assetsTotal: Int32;
  deltaPercent: Percentage<Int16>;
  stateName: string;
  padding2F: UInt8;
}
const AiTechnologyGoalSchema = z.object({
  targetPercents: z.array(Int16Schema).length(8),
  technologyType: TechnologyTypeSchema,
  stateName: z.string(),
});
type AiTechnologyGoalJson = z.infer<typeof AiTechnologyGoalSchema>;
const AiTechnologyGoalJsonMapping: JsonFieldMapping<
  AiTechnologyGoal,
  AiTechnologyGoalJson
>[] = [
  { field: "targetPercents" },
  { field: "technologyType" },
  { objectField: "padding12", fromJson: () => asUInt16(0) },
  { objectField: "assetsTotal", fromJson: () => asInt32(0) },
  { objectField: "deltaPercent", fromJson: () => asInt16(0) },
  { field: "stateName" },
  { objectField: "padding2F", fromJson: () => asUInt8(0) },
];

const TribeAiSchema = z.object({
  objectGoals: z.array(AiObjectGoalSchema),
  technologyGoals: z.array(AiTechnologyGoalSchema),
  aiGroups: z.array(AiGroupSchema).length(5),
  field9C: z.array(UInt8Schema).length(7),
  fieldA3: z.array(UInt8Schema).length(6),
});
type TribeAiJson = z.infer<typeof TribeAiSchema>;

const TribeAiJsonMapping: JsonFieldMapping<TribeAi, TribeAiJson>[] = [
  {
    jsonField: "objectGoals",
    toJson: (obj, savingContext) =>
      obj.objectGoals.map((objectGoal) =>
        transformObjectToJson(
          objectGoal,
          AiObjectGoalJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "objectGoals",
    fromJson: (json, _obj, loadingContext) =>
      json.objectGoals.map((objectGoal) =>
        transformJsonToObject(
          objectGoal,
          AiObjectGoalJsonMapping,
          loadingContext,
        ),
      ),
  },
  {
    jsonField: "technologyGoals",
    toJson: (obj, savingContext) =>
      obj.technologyGoals.map((technologyGoal) =>
        transformObjectToJson(
          technologyGoal,
          AiTechnologyGoalJsonMapping,
          savingContext,
        ),
      ),
  },
  {
    objectField: "technologyGoals",
    fromJson: (json, _obj, loadingContext) =>
      json.technologyGoals.map((objectGoal) =>
        transformJsonToObject(
          objectGoal,
          AiTechnologyGoalJsonMapping,
          loadingContext,
        ),
      ),
  },
  {
    jsonField: "aiGroups",
    toJson: (obj, savingContext) =>
      obj.aiGroups.map((aiGroup) =>
        transformObjectToJson(aiGroup, AiGroupJsonMapping, savingContext),
      ),
  },
  {
    objectField: "aiGroups",
    fromJson: (json, _obj, loadingContext) =>
      json.aiGroups.map((aiGroup) =>
        transformJsonToObject(aiGroup, AiGroupJsonMapping, loadingContext),
      ),
  },
  { field: "field9C" },
  { field: "fieldA3" },
  { objectField: "fieldCE", fromJson: () => asUInt16(10) },
  { objectField: "fieldD0", fromJson: () => asUInt16(12) },
];

export class TribeAi {
  referenceId: string = "";
  id: Int16 = asInt16(-1);
  padding02: UInt16 = asUInt16(0);
  objectGoalsPointer: Pointer = NullPointer;
  objectGoals: AiObjectGoal[] = [];
  objectPrototypeCount: Int16 = asInt16(0);
  padding0A: UInt16 = asUInt16(0);
  objectIdToGoalMapPointer: Pointer = NullPointer;
  objectTotalCostsPointer: Pointer = NullPointer;
  padding16: UInt16 = asUInt16(0);
  technologyGoalsPointer: Pointer = NullPointer;
  technologyGoals: AiTechnologyGoal[] = [];
  technologyIdToGoalMapPointer: Pointer = NullPointer;
  technologyTotalCostsPointer: Pointer = NullPointer;
  aiGroups: AiGroup[] = [];
  field9C: UInt8[] = [];
  fieldA3: UInt8[] = [];
  paddingA9: UInt8 = asUInt8(0);
  paddingAA: UInt16 = asUInt16(0);
  ordersPointer: Pointer = NullPointer;
  playerPointer: Pointer = NullPointer;
  logFilePointer: Pointer = NullPointer;
  currentAge: AgeId<Int16> = asInt16(0);
  paddingBA: UInt16 = asUInt16(0);
  townCenterPointer: Pointer = NullPointer;
  fieldC0: UInt8 = asUInt8(0);
  paddingC1: UInt8 = asUInt8(0);
  paddingC2: UInt16 = asUInt16(0);
  fieldC4: UInt32 = asUInt32(0);
  worldTime: Float32 = asFloat32(0);
  fieldCC: UInt8 = asUInt8(0);
  quickThink: Bool8 = asBool8(false);
  fieldCE: UInt16 = asUInt16(0);
  fieldD0: UInt32 = asUInt32(0);
  loggingEnabled: Bool16 = asBool16(false);
  paddingD6: UInt16 = asUInt16(0);

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    loadingContext: LoadingContext,
  ): void {
    if (semver.gte(loadingContext.version.numbering, "2.0.0")) {
      return;
    }
    this.id = id;
    this.referenceId = createReferenceIdFromString(`Ai ${this.id + 1}`);

    const objectStatesCount = buffer.readInt16();
    this.padding02 = buffer.readUInt16();
    this.objectGoalsPointer = buffer.readPointer();
    this.objectPrototypeCount = buffer.readInt16();
    this.padding0A = buffer.readUInt16();
    this.objectIdToGoalMapPointer = buffer.readPointer();
    this.objectTotalCostsPointer = buffer.readPointer();
    const technologyStatesCount = buffer.readInt16();
    this.padding16 = buffer.readUInt16();
    this.technologyGoalsPointer = buffer.readPointer();
    this.technologyIdToGoalMapPointer = buffer.readPointer();
    this.technologyTotalCostsPointer = buffer.readPointer();

    this.aiGroups = [];
    for (let i = 0; i < 5; ++i) {
      const targetPercents: Percentage<Int16>[] = [];
      for (let i = 0; i < 8; ++i) {
        targetPercents.push(buffer.readInt16());
      }
      this.aiGroups.push({
        targetPercents,
        assetsTotal: buffer.readInt32(),
        deltaPercent: buffer.readInt16(),
        padding16: buffer.readUInt16(),
      });
    }

    this.field9C = [];
    for (let i = 0; i < 7; ++i) {
      this.field9C.push(buffer.readUInt8());
    }
    this.fieldA3 = [];
    for (let i = 0; i < 6; ++i) {
      this.fieldA3.push(buffer.readUInt8());
    }
    this.paddingA9 = buffer.readUInt8();
    this.paddingAA = buffer.readUInt16();
    this.ordersPointer = buffer.readPointer();
    this.playerPointer = buffer.readPointer();
    this.logFilePointer = buffer.readPointer();
    this.currentAge = buffer.readInt16();
    this.paddingBA = buffer.readUInt16();
    this.townCenterPointer = buffer.readPointer();
    this.fieldC0 = buffer.readUInt8();
    this.paddingC1 = buffer.readUInt8();
    this.paddingC2 = buffer.readUInt16();
    this.fieldC4 = buffer.readUInt32();
    this.worldTime = buffer.readFloat32();
    this.fieldCC = buffer.readUInt8();
    this.quickThink = buffer.readBool8();
    this.fieldCE = buffer.readUInt16();
    this.fieldD0 = buffer.readUInt32();
    this.loggingEnabled = buffer.readBool16();
    this.paddingD6 = buffer.readUInt16();

    this.objectGoals = [];
    for (let i = 0; i < objectStatesCount; ++i) {
      const targetCounts: Int16[] = [];
      const targetPercents: Percentage<Int16>[] = [];
      for (let i = 0; i < 8; ++i) {
        targetCounts.push(buffer.readInt16());
      }
      for (let i = 0; i < 8; ++i) {
        targetPercents.push(buffer.readInt16());
      }
      this.objectGoals.push({
        targetCounts,
        targetPercents,
        prototypeId: buffer.readInt16<PrototypeId<Int16>>(),
        prototype: null,
        objectClass: buffer.readInt16<ObjectClass>(),
        aiGroupId: buffer.readInt16(),
        objectCount: buffer.readInt16(),
        assetsTotal: buffer.readInt32(),
        deltaPercent: buffer.readInt16(),
        stateName: buffer.readFixedSizeString(21),
        padding43: buffer.readUInt8(),
      });
    }

    this.technologyGoals = [];
    for (let i = 0; i < technologyStatesCount; ++i) {
      const targetPercents: Percentage<Int16>[] = [];
      for (let i = 0; i < 8; ++i) {
        targetPercents.push(buffer.readInt16());
      }
      this.technologyGoals.push({
        targetPercents,
        technologyType: buffer.readInt16<TechnologyType>(),
        padding12: buffer.readUInt16(),
        assetsTotal: buffer.readInt32(),
        deltaPercent: buffer.readInt16(),
        stateName: buffer.readFixedSizeString(21),
        padding2F: buffer.readUInt8(),
      });
    }
  }

  readFromJsonFile(
    jsonFile: TribeAiJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    this.id = id;
    this.referenceId = referenceId;
    applyJsonFieldsToObject(jsonFile, this, TribeAiJsonMapping, loadingContext);
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    _savingContext: SavingContext,
  ) {
    textFileWriter.integer(this.id).eol();

    textFileWriter.indent(4).raw(this.objectGoals.length).eol();

    this.objectGoals.forEach((objectGoal) => {
      textFileWriter
        .indent(6)
        .integer(objectGoal.prototypeId)
        .integer(objectGoal.objectClass)
        .integer(objectGoal.aiGroupId)
        .string(objectGoal.stateName, 21);

      for (let i = 0; i < 8; ++i) {
        textFileWriter
          .integer(objectGoal.targetCounts[i])
          .integer(objectGoal.targetPercents[i]);
      }
      textFileWriter.eol();
    });

    textFileWriter.indent(2);
    for (let i = 0; i < 7; ++i) {
      textFileWriter.integer(this.field9C[i]);
    }
    for (let i = 0; i < 6; ++i) {
      textFileWriter.integer(this.fieldA3[i]);
    }
    textFileWriter.eol();

    textFileWriter.indent(4).raw(this.technologyGoals.length).eol();

    this.technologyGoals.forEach((techGoal) => {
      textFileWriter
        .indent(6)
        .integer(techGoal.technologyType)
        .string(techGoal.stateName, 21);

      for (let i = 0; i < 8; ++i) {
        textFileWriter.integer(techGoal.targetPercents[i]);
      }
      textFileWriter.eol();
    });

    for (let i = 0; i < 5; ++i) {
      textFileWriter.indent(2);
      for (let j = 0; j < 8; ++j) {
        textFileWriter.integer(this.aiGroups[i].targetPercents[j]);
      }
      textFileWriter.eol();
    }
  }

  linkOtherData(
    objects: Nullable<BaseObjectPrototype>[],
    loadingContext: LoadingContext,
  ) {
    this.objectGoals.forEach((objectState) => {
      objectState.prototype = getDataEntry(
        objects,
        objectState.prototypeId,
        "ObjectPrototype",
        this.referenceId,
        loadingContext,
      );
    });
  }

  writeToJsonFile(directory: string, savingContext: SavingContext) {
    writeFileSync(
      path.join(directory, `${this.referenceId}.json`),
      createJson(this.toJson(savingContext)),
    );
  }

  toJson(savingContext: SavingContext) {
    return transformObjectToJson(this, TribeAiJsonMapping, savingContext);
  }
}

export function readTribeAisFromBuffer(
  buffer: BufferReader,
  loadingContext: LoadingContext,
): Nullable<TribeAi>[] {
  const result: Nullable<TribeAi>[] = [];
  if (semver.lt(loadingContext.version.numbering, "2.0.0")) {
    const aiEntryCount = buffer.readInt16();
    const validAis: boolean[] = [];
    for (let i = 0; i < aiEntryCount; ++i) {
      validAis.push(buffer.readBool32());
    }
    for (let i = 0; i < aiEntryCount; ++i) {
      if (validAis[i]) {
        const tribeAi = new TribeAi();
        tribeAi.readFromBuffer(buffer, asInt16(i), loadingContext);
        result.push(tribeAi);
      }
    }
  }
  return result;
}

export function readTribeAisFromJsonFiles(
  inputDirectory: string,
  tribeAiIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const aiDirectory = path.join(inputDirectory, "tribeai");
  const tribeAis: Nullable<TribeAi>[] = [];
  tribeAiIds.forEach((tribeAiReferenceId, tribeAiNumberId) => {
    if (tribeAiReferenceId === null) {
      tribeAis.push(null);
    } else {
      const tribeAiJson = TribeAiSchema.parse(
        JSON5.parse(
          readFileSync(
            path.join(aiDirectory, `${tribeAiReferenceId}.json`),
          ).toString("utf8"),
        ),
      );
      const tribeAi = new TribeAi();
      tribeAi.readFromJsonFile(
        tribeAiJson,
        asInt16(tribeAiNumberId),
        tribeAiReferenceId,
        loadingContext,
      );
      tribeAis.push(tribeAi);
    }
  });
  return tribeAis;
}

export function writeTribeAisToWorldTextFile(
  outputDirectory: string,
  aiEntries: Nullable<TribeAi>[],
  savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.TribeAi),
  );
  textFileWriter.raw(aiEntries.length).eol();

  aiEntries.forEach((aiEntry) => {
    aiEntry?.appendToTextFile(textFileWriter, savingContext);
  });

  textFileWriter.close();
}

export function writeTribeAisToJsonFiles(
  outputDirectory: string,
  aiEntries: Nullable<TribeAi>[],
  savingContext: SavingContext,
) {
  if (semver.lt(savingContext.version.numbering, "2.0.0")) {
    writeDataEntriesToJson(
      outputDirectory,
      "tribeai",
      aiEntries,
      savingContext,
    );
  }
}

export function readTribeAiIdsFromJsonIndex(inputDirectory: string) {
  try {
    return readJsonFileIndex(path.join(inputDirectory, "tribeai"));
  } catch (_err: unknown) {
    return [];
  }
}
