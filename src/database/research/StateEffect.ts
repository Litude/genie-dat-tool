import JSON5 from "json5";
import semver from "semver";
import BufferReader from "../../BufferReader";
import { TextFileNames } from "../../textfile/TextFile";
import { TextFileWriter } from "../../textfile/TextFileWriter";
import { JsonLoadingContext, LoadingContext } from "../LoadingContext";
import { SavingContext } from "../SavingContext";
import {
  asInt16,
  Float32,
  Float32Schema,
  Int16,
  Int16Schema,
} from "../../ts/base-types";
import path from "path";
import { createReferenceIdFromString } from "../../json/reference-id";
import { isDefined, Nullable } from "../../ts/ts-utils";
import { readFileSync, writeFileSync } from "fs";
import { Civilization } from "../Civilization";
import { Technology } from "./Technology";
import {
  applyJsonFieldsToObject,
  createJson,
  JsonFieldMapping,
  readJsonFileIndex,
  transformObjectToJson,
  writeDataEntriesToJson,
} from "../../json/json-serialization";
import { z } from "zod";

// TODO: Split different command types in JSON to make the JSON more readable and allow usage of references

interface EffectCommand {
  commandType: Int16; // Note: This is actually UInt8 in the data, but text files use -1 for none so this must be at least int16 here
  value1: Int16;
  value2: Int16;
  value3: Int16;
  value4: Float32;
}

const StateEffectSchema = z.object({
  internalName: z.string(),
  commands: z.array(
    z.object({
      commandType: Int16Schema,
      value1: Int16Schema,
      value2: Int16Schema,
      value3: Int16Schema,
      value4: Float32Schema,
    }),
  ),
});

type StateEffectJson = z.infer<typeof StateEffectSchema>;

const StateEffectJsonMapping: JsonFieldMapping<StateEffect, StateEffectJson>[] =
  [{ field: "internalName" }, { field: "commands" }];

export class StateEffect {
  referenceId: string = "";
  id: Int16 = asInt16(-1);
  internalName: string = "";
  commands: EffectCommand[] = [];

  readFromBuffer(
    buffer: BufferReader,
    id: Int16,
    _loadingContext: LoadingContext,
  ): void {
    this.id = id;
    this.internalName = buffer.readFixedSizeString(31);
    this.referenceId = createReferenceIdFromString(this.internalName);
    const commandCount = buffer.readInt16();
    this.commands = [];
    for (let i = 0; i < commandCount; ++i) {
      const commandType = buffer.readUInt8();
      this.commands.push({
        commandType: asInt16(commandType === 255 ? -1 : commandType),
        value1: buffer.readInt16(),
        value2: buffer.readInt16(),
        value3: buffer.readInt16(),
        value4: buffer.readFloat32(),
      });
    }
  }

  readFromJsonFile(
    jsonFile: StateEffectJson,
    id: Int16,
    referenceId: string,
    loadingContext: JsonLoadingContext,
  ) {
    this.id = id;
    this.referenceId = referenceId;
    applyJsonFieldsToObject(
      jsonFile,
      this,
      StateEffectJsonMapping,
      loadingContext,
    );
  }

  appendToTextFile(
    textFileWriter: TextFileWriter,
    savingContext: SavingContext,
  ): void {
    textFileWriter
      .dynamic((writer) => {
        if (semver.gte(savingContext.version.numbering, "2.0.0")) {
          writer.integer(this.id);
        }
      })
      .string(this.internalName, 17)
      .integer(this.commands.length)
      .eol();

    for (let j = 0; j < this.commands.length; ++j) {
      const command = this.commands[j];
      textFileWriter
        .indent(9)
        .integer(command.commandType)
        .integer(command.value1)
        .integer(command.value2)
        .integer(command.value3)
        .float(command.value4)
        .eol();
    }
  }

  writeToJsonFile(directory: string, savingContext: SavingContext) {
    writeFileSync(
      path.join(directory, `${this.referenceId}.json`),
      createJson(this.toJson(savingContext)),
    );
  }

  isValid() {
    return this.internalName !== "";
  }

  toJson(savingContext: SavingContext) {
    return transformObjectToJson(this, StateEffectJsonMapping, savingContext);
  }
}

export function readStateEffectsFromBuffer(
  buffer: BufferReader,
  loadingContext: LoadingContext,
): (StateEffect | null)[] {
  const result: (StateEffect | null)[] = [];
  const effectCount = buffer.readInt32();
  for (let i = 0; i < effectCount; ++i) {
    const stateEffect = new StateEffect();
    stateEffect.readFromBuffer(buffer, asInt16(i), loadingContext);
    result.push(stateEffect.isValid() ? stateEffect : null);
  }

  return result;
}

// this format has changed a lot since the alpha days...
export function writeStateEffectsToWorldTextFile(
  outputDirectory: string,
  effects: (StateEffect | null)[],
  savingContext: SavingContext,
) {
  const textFileWriter = new TextFileWriter(
    path.join(outputDirectory, TextFileNames.StateEffects),
  );
  textFileWriter.raw(effects.length).eol(); // Total state effect entries
  const validEntries = effects.filter(isDefined);
  if (semver.gte(savingContext.version.numbering, "2.0.0")) {
    textFileWriter.raw(validEntries.length).eol(); // Entries that have data
  }
  if (
    validEntries.length !== effects.length &&
    semver.lt(savingContext.version.numbering, "2.0.0")
  ) {
    throw new Error(
      "Saving dummy effect entries not implemented for version < 2.0",
    );
  }

  validEntries.forEach((entry) => {
    entry.appendToTextFile(textFileWriter, savingContext);
  });
  textFileWriter.close();
}

export function createFallbackStateEffectReferenceIdsIfNeeded(
  stateEffects: Nullable<StateEffect>[],
  technologies: Nullable<Technology>[],
  civilizations: Nullable<Civilization>[],
  hardcodedNames: Record<number, string> = {},
) {
  const uniqueStateEffectNames = new Set([
    ...stateEffects
      .filter(isDefined)
      .map((stateEffect) => stateEffect?.internalName),
  ]);
  if (uniqueStateEffectNames.size === 1) {
    stateEffects.forEach((effect) => {
      if (effect) {
        effect.referenceId = "";
      }
    });
    technologies.filter(isDefined).forEach((technology) => {
      if (
        technology.stateEffectId >= 0 &&
        technology.stateEffectId < stateEffects.length
      ) {
        const stateEffect = stateEffects[technology.stateEffectId];
        if (stateEffect) {
          stateEffect.referenceId = createReferenceIdFromString(
            `Tech ${technology.internalName}`,
          );
        }
      }
    });
    civilizations.filter(isDefined).forEach((civilization) => {
      if (
        civilization.bonusEffectId >= 0 &&
        civilization.bonusEffectId < stateEffects.length
      ) {
        const stateEffect = stateEffects[civilization.bonusEffectId];
        if (stateEffect) {
          stateEffect.referenceId = createReferenceIdFromString(
            `Civ ${civilization.internalName}`,
          );
        }
      }
    });
    for (const [key, value] of Object.entries(hardcodedNames)) {
      const stateEffect = stateEffects[+key];
      if (stateEffect?.referenceId === "") {
        stateEffect.referenceId = createReferenceIdFromString(value);
      }
    }
    const defaultName = [...uniqueStateEffectNames.values()][0];
    stateEffects.forEach((effect) => {
      if (effect?.referenceId === "") {
        if (effect.commands.length === 0) {
          effect.referenceId = "None";
        } else {
          effect.referenceId = createReferenceIdFromString(defaultName);
        }
      }
    });
  }
}

export function writeStateEffectsToJsonFiles(
  outputDirectory: string,
  stateEffects: (StateEffect | null)[],
  savingContext: SavingContext,
) {
  writeDataEntriesToJson(
    outputDirectory,
    "effects",
    stateEffects,
    savingContext,
  );
}

export function readStateEffectsFromJsonFiles(
  inputDirectory: string,
  stateEffectIds: (string | null)[],
  loadingContext: JsonLoadingContext,
) {
  const stateEffectsDirectory = path.join(inputDirectory, "effects");
  const stateEffects: Nullable<StateEffect>[] = [];
  stateEffectIds.forEach((stateEffectReferenceId, stateEffectNumberId) => {
    if (stateEffectReferenceId === null) {
      stateEffects.push(null);
    } else {
      const stateEffectJson = StateEffectSchema.parse(
        JSON5.parse(
          readFileSync(
            path.join(stateEffectsDirectory, `${stateEffectReferenceId}.json`),
          ).toString("utf8"),
        ),
      );
      const stateEffect = new StateEffect();
      stateEffect.readFromJsonFile(
        stateEffectJson,
        asInt16(stateEffectNumberId),
        stateEffectReferenceId,
        loadingContext,
      );
      stateEffects.push(stateEffect);
    }
  });
  return stateEffects;
}

export function readStateEffectIdsFromJsonIndex(inputDirectory: string) {
  return readJsonFileIndex(path.join(inputDirectory, "effects"));
}
