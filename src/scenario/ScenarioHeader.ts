import BufferReader from "../BufferReader";
import { ParsingError } from "../database/Error";
import {
  asBool32,
  asInt32,
  asUInt32,
  Bool32,
  Int32,
  UInt32,
} from "../ts/base-types";

export class ScenarioHeader {
  headerVersion: Int32 = asInt32(0);
  checksum: UInt32 = asUInt32(0);
  modifyDate: number = 0;
  description: string = "";
  individualVictoryConditions: Bool32 = asBool32(false);
  playerCount: Int32 = asInt32(0);

  static readFromBuffer(buffer: BufferReader, modifyDate: number) {
    const header = new ScenarioHeader();
    const headerSize = buffer.readUInt32();
    const startOffset = buffer.tell();
    header.headerVersion = buffer.readInt32();
    if (header.headerVersion < 1 || header.headerVersion > 2) {
      throw new ParsingError(
        `Encountered unsupported/unexpected header version ${header.headerVersion}`,
      );
    }
    if (header.headerVersion >= 2) {
      header.checksum = buffer.readUInt32();
      header.modifyDate = Math.round(header.checksum * 1000);
    } else {
      header.checksum = asUInt32(Math.round(modifyDate / 1000));
      header.modifyDate = modifyDate;
    }

    header.description = buffer.readPascalString32();
    header.individualVictoryConditions = buffer.readBool32();
    header.playerCount = buffer.readInt32();

    const endOffset = buffer.tell();
    if (headerSize !== 0 && headerSize !== endOffset - startOffset) {
      throw new ParsingError(
        `Something went wrong with header parsing. Parsed ${endOffset - startOffset} bytes but size should be ${headerSize}`,
      );
    }

    return header;
  }
}
