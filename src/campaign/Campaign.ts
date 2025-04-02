import BufferReader, { BufferSeekWhence } from "../BufferReader";
import {
  ScenarioContainer,
  ScenarioParsingAmount,
} from "../scenario/ScenarioContainer";

export interface CampaignScenario {
  name: string;
  filename: string;
  data: Buffer;
  modifyDate: number;
}

export class Campaign {
  version: string = "";
  name: string = "";
  scenarios: CampaignScenario[] = [];

  static readFromBuffer(inputBuffer: BufferReader, modifyDate: number) {
    const campaign = new Campaign();
    campaign.version = inputBuffer.readFixedSizeString(4);
    if (campaign.version !== "1.00") {
      throw new Error(`Unexpected campaign version ${campaign.version}!`);
    }

    campaign.name = inputBuffer.readFixedSizeString(256);

    const scenarioCount = inputBuffer.readInt32();

    for (let i = 0; i < scenarioCount; ++i) {
      const fileSize = inputBuffer.readUInt32();
      const offset = inputBuffer.readUInt32();
      const name = inputBuffer.readFixedSizeString(255);
      const filename = inputBuffer.readFixedSizeString(255);
      inputBuffer.seek(2, BufferSeekWhence.Relative); // skip padding bytes

      const scenarioData = inputBuffer.slice(offset, offset + fileSize);

      const headerData = ScenarioContainer.readFromBuffer(
        new BufferReader(scenarioData),
        modifyDate,
        ScenarioParsingAmount.Header,
      );
      const scenarioModifyDate = headerData.header.modifyDate;

      const campaignScenario: CampaignScenario = {
        name,
        filename,
        data: scenarioData,
        modifyDate: scenarioModifyDate,
      };

      campaign.scenarios.push(campaignScenario);
    }
    return campaign;
  }
}
