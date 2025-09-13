import BufferReader from "../BufferReader";
import { FileEntry } from "../files/FileEntry";
import { asUInt32, asUInt8, UInt32, UInt8 } from "../ts/base-types";
import { ScenarioLoadingContext } from "./ScenarioLoadingContext";

export interface AiFile {
  name: string;
  fileSize: UInt32;
  data: Buffer | null;
  content: string;
}

export class ScenarioAiData {
  aiStrategy: AiFile = {
    name: "",
    fileSize: asUInt32(0),
    data: null,
    content: "",
  };
  aiCityPlan: AiFile = {
    name: "",
    fileSize: asUInt32(0),
    data: null,
    content: "",
  };
  aiPersonality: AiFile = {
    name: "Random",
    fileSize: asUInt32(0),
    data: null,
    content: "",
  };
  ruleType: UInt8 = asUInt8(0);

  getEmbeddedFiles(modifyDate: number) {
    const files: FileEntry[] = [];
    if (this.aiStrategy.fileSize > 0 && this.aiStrategy.data) {
      const aiStrategyFile = new FileEntry({
        data: this.aiStrategy.data,
        filename: `${this.aiStrategy.name}.ai`,
        modificationTime: modifyDate,
      });
      files.push(aiStrategyFile);
    }
    if (this.aiCityPlan.fileSize > 0 && this.aiCityPlan.data) {
      const aiCityPlanFile = new FileEntry({
        data: this.aiCityPlan.data,
        filename: `${this.aiCityPlan.name}.cty`,
        modificationTime: modifyDate,
      });
      files.push(aiCityPlanFile);
    }
    if (this.aiPersonality.fileSize > 0 && this.aiPersonality.data) {
      const aiPersonalityFile = new FileEntry({
        data: this.aiPersonality.data,
        filename: `${this.aiPersonality.name}.per`,
        modificationTime: modifyDate,
      });
      files.push(aiPersonalityFile);
    }
    return files;
  }

  static readFromBuffer(
    buffer: BufferReader,
    loadingContext: ScenarioLoadingContext,
    encoding: string = "latin1",
  ) {
    const strategyNames: string[] = [];
    const cityPlanNames: string[] = [];
    const personalityNames: string[] = [];
    const strategyFileSizes: UInt32[] = [];
    const cityPlanFileSizes: UInt32[] = [];
    const personalityFileSizes: UInt32[] = [];
    const strategies: Buffer[] = [];
    const cityPlans: Buffer[] = [];
    const personalities: Buffer[] = [];
    const ruleTypes: UInt8[] = [];
    for (let i = 0; i < 16; ++i) {
      strategyNames.push(buffer.readPascalString16(encoding));
    }
    for (let i = 0; i < 16; ++i) {
      cityPlanNames.push(buffer.readPascalString16(encoding));
    }
    if (loadingContext.dataVersion >= 1.08) {
      for (let i = 0; i < 16; ++i) {
        personalityNames.push(buffer.readPascalString16(encoding));
      }
    }

    for (let i = 0; i < 16; ++i) {
      strategyFileSizes.push(buffer.readUInt32());
      cityPlanFileSizes.push(buffer.readUInt32());
      if (loadingContext.dataVersion >= 1.08) {
        personalityFileSizes.push(buffer.readUInt32());
      }

      if (loadingContext.dataVersion >= 1.15) {
        strategies.push(buffer.readBuffer(strategyFileSizes[i]));
        cityPlans.push(buffer.readBuffer(cityPlanFileSizes[i]));
        personalities.push(buffer.readBuffer(personalityFileSizes[i]));
      }
    }

    if (loadingContext.dataVersion <= 1.02) {
      for (let i = 0; i < 16; ++i) {
        strategies.push(buffer.readBuffer(strategyFileSizes[i]));
      }
      for (let i = 0; i < 16; ++i) {
        cityPlans.push(buffer.readBuffer(cityPlanFileSizes[i]));
      }
    }

    // eslint-disable-next-line prettier/prettier
    if (loadingContext.dataVersion >= 1.20) {
      for (let i = 0; i < 16; ++i) {
        ruleTypes.push(buffer.readUInt8());
      }
    }

    const result: ScenarioAiData[] = [];
    for (let i = 0; i < 16; ++i) {
      const playerAiData = new ScenarioAiData();
      playerAiData.aiStrategy.name = strategyNames[i];
      playerAiData.aiStrategy.fileSize = strategyFileSizes[i];
      playerAiData.aiStrategy.data = strategies[i] ?? null;
      if (playerAiData.aiStrategy.data) {
        playerAiData.aiStrategy.content =
          playerAiData.aiStrategy.data.toString("latin1");
      }

      playerAiData.aiCityPlan.name = cityPlanNames[i];
      playerAiData.aiCityPlan.fileSize = cityPlanFileSizes[i];
      playerAiData.aiCityPlan.data = cityPlans[i] ?? null;
      if (playerAiData.aiCityPlan.data) {
        playerAiData.aiCityPlan.content =
          playerAiData.aiCityPlan.data.toString("latin1");
      }

      if (loadingContext.dataVersion >= 1.08) {
        playerAiData.aiPersonality.name = personalityNames[i];
        playerAiData.aiPersonality.fileSize = personalityFileSizes[i];
        playerAiData.aiPersonality.data = personalities[i] ?? null;
        if (playerAiData.aiPersonality.data) {
          playerAiData.aiPersonality.content =
            playerAiData.aiPersonality.data.toString("latin1");
        }
      }
      // eslint-disable-next-line prettier/prettier
      if (loadingContext.dataVersion >= 1.20) {
        playerAiData.ruleType = ruleTypes[i];
      }

      result.push(playerAiData);
    }

    return result;
  }
}
