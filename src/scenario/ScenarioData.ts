import BufferReader from "../BufferReader";
import { ParsingError } from "../database/Error";
import { CivilizationId, StringId } from "../database/Types";
import {
  asBool32,
  asBool8,
  asInt32,
  Bool32,
  Bool8,
  Int32,
} from "../ts/base-types";
import { ScenarioAiData } from "./ScenarioAiData";
import { ScenarioEvents } from "./ScenarioEvents";
import { ScenarioLoadingContext } from "./ScenarioLoadingContext";
import { ScenarioPresentationData } from "./ScenarioPresentationData";

export class ScenarioData {
  playerNames: string[] = [];
  playerNameStringIds: StringId<Int32>[] = [];
  playersEnabled: Bool32[] = [];
  playerTypes: Int32[] = [];
  playerCivilizations: CivilizationId<Int32>[] = [];
  aiEmotions: Int32[] = [];
  scenarioEvents: ScenarioEvents = new ScenarioEvents();
  presentationData: ScenarioPresentationData = new ScenarioPresentationData();
  aiData: ScenarioAiData[] = [];
  conquestVictory: Bool8 = asBool8(true);
  playerStartingResources: {
    food: Int32;
    wood: Int32;
    gold: Int32;
    stone: Int32;
    ore: Int32;
    tradeGoods: Int32;
  }[] = [];
  globalVictory: {
    conquest: Bool32;
    ruins: Int32;
    artifacts: Int32;
    discoveries: Int32;
    exploration: Int32;
    gold: Int32;
    allConditionsRequired: Bool32;
    mainCondition: Int32;
    scoreThreshold: Int32;
    timeLimit: Int32;
  } = {
    conquest: asBool32(true),
    ruins: asInt32(0),
    artifacts: asInt32(0),
    discoveries: asInt32(0),
    exploration: asInt32(0),
    gold: asInt32(0),
    allConditionsRequired: asBool32(false),
    mainCondition: asInt32(4),
    scoreThreshold: asInt32(9000),
    timeLimit: asInt32(900),
  };

  static readFromBuffer(
    buffer: BufferReader,
    loadingContext: ScenarioLoadingContext,
    encoding: string = "latin1",
  ) {
    const scenarioData = new ScenarioData();
    if (loadingContext.dataVersion >= 1.14) {
      for (let i = 0; i < 16; ++i) {
        scenarioData.playerNames.push(
          buffer.readFixedSizeString(256, encoding),
        );
      }
      if (loadingContext.dataVersion >= 1.16) {
        for (let i = 0; i < 16; ++i) {
          scenarioData.playerNameStringIds.push(
            buffer.readInt32<StringId<Int32>>(),
          );
        }
      }

      for (let i = 0; i < 16; ++i) {
        scenarioData.playersEnabled.push(buffer.readBool32());
        scenarioData.playerTypes.push(buffer.readInt32());
        scenarioData.playerCivilizations.push(
          buffer.readInt32<CivilizationId<Int32>>(),
        );
        scenarioData.aiEmotions.push(buffer.readInt32());
      }
    }

    if (loadingContext.dataVersion >= 1.07) {
      scenarioData.conquestVictory = buffer.readBool8();
    }

    scenarioData.scenarioEvents = ScenarioEvents.readFromBuffer(buffer);
    scenarioData.presentationData = ScenarioPresentationData.readFromBuffer(
      buffer,
      loadingContext,
      encoding,
    );
    scenarioData.aiData = ScenarioAiData.readFromBuffer(buffer, loadingContext);

    if (loadingContext.dataVersion >= 1.03) {
      const checkPointValue = buffer.readUInt32();
      if (checkPointValue !== 0xffffff9d) {
        throw new ParsingError(
          `Checkpoint value 1 was invalid, got ${checkPointValue}`,
        );
      }
    }

    if (loadingContext.dataVersion <= 1.13) {
      for (let i = 0; i < 16; ++i) {
        scenarioData.playerNames.push(
          buffer.readFixedSizeString(256, encoding),
        );
      }
    }

    for (let i = 0; i < 16; ++i) {
      if (loadingContext.dataVersion <= 1.13) {
        scenarioData.playersEnabled.push(buffer.readBool32());
      }
      const startingGold = buffer.readInt32();
      const startingWood = buffer.readInt32();
      const startingFood = buffer.readInt32();
      const startingStone = buffer.readInt32();
      let startingOre = asInt32(0);
      let startingTradeGoods = asInt32(0);
      if (loadingContext.dataVersion >= 1.17) {
        startingOre = buffer.readInt32();
        startingTradeGoods = buffer.readInt32();
      }
      scenarioData.playerStartingResources.push({
        food: startingFood,
        wood: startingWood,
        gold: startingGold,
        stone: startingStone,
        ore: startingOre,
        tradeGoods: startingTradeGoods,
      });

      if (loadingContext.dataVersion <= 1.13) {
        scenarioData.playerTypes.push(buffer.readInt32());
        scenarioData.playerCivilizations.push(
          buffer.readInt32<CivilizationId<Int32>>(),
        );
        scenarioData.aiEmotions.push(buffer.readInt32());
      }
    }

    if (loadingContext.dataVersion >= 1.03) {
      const checkPointValue = buffer.readUInt32();
      if (checkPointValue !== 0xffffff9d) {
        throw new ParsingError(
          `Checkpoint value 2 was invalid, got ${checkPointValue}`,
        );
      }
    }

    scenarioData.globalVictory.conquest = buffer.readBool32(); // This is ignored and overwritten later...
    scenarioData.globalVictory.ruins = buffer.readInt32();
    scenarioData.globalVictory.artifacts = buffer.readInt32();
    scenarioData.globalVictory.discoveries = buffer.readInt32();
    scenarioData.globalVictory.exploration = buffer.readInt32();
    scenarioData.globalVictory.gold = buffer.readInt32();
    scenarioData.globalVictory.allConditionsRequired = buffer.readBool32();
    if (loadingContext.dataVersion >= 1.13) {
      scenarioData.globalVictory.mainCondition = buffer.readInt32();
      scenarioData.globalVictory.scoreThreshold = buffer.readInt32();
      scenarioData.globalVictory.timeLimit = buffer.readInt32();
    }
    scenarioData.globalVictory.conquest = asBool32(
      scenarioData.conquestVictory,
    );

    // TODO: Parsing is incomplete

    return scenarioData;
  }
}
