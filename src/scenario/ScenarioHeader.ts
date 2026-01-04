import BufferReader from "../BufferReader";
import { ParsingError } from "../database/Error";
import { Logger } from "../Logger";
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

  static readFromBuffer(
    buffer: BufferReader,
    modifyDate: number,
    encoding: string = "latin1",
    parsingOptions: {
      parseVersionZero?: boolean;
      allowSizeMismatch?: boolean;
    } = {},
  ) {
    const header = new ScenarioHeader();
    const headerSize = buffer.readUInt32();
    const startOffset = buffer.tell();
    header.headerVersion = buffer.readInt32();
    if (header.headerVersion < 1 || header.headerVersion > 2) {
      if (header.headerVersion !== 0 || !parsingOptions.parseVersionZero) {
        throw new ParsingError(
          `Encountered unsupported/unexpected header version ${header.headerVersion}`,
        );
      }
    }
    if (header.headerVersion >= 2) {
      header.checksum = buffer.readUInt32();
      header.modifyDate = Math.round(header.checksum * 1000);
    } else {
      header.checksum = asUInt32(Math.round(modifyDate / 1000));
      header.modifyDate = modifyDate;
    }

    header.description = buffer.readPascalString32(encoding);
    header.individualVictoryConditions = buffer.readBool32();
    header.playerCount = buffer.readInt32();

    const endOffset = buffer.tell();
    if (headerSize !== 0 && headerSize !== endOffset - startOffset) {
      // Sometimes the header size seems to include the first field, and sometimes not, so if the diff is 4 bytes, allow it
      if (
        headerSize - 4 !== endOffset - startOffset ||
        !parsingOptions.allowSizeMismatch
      ) {
        throw new ParsingError(
          `Something went wrong with header parsing. Parsed ${endOffset - startOffset} bytes but size should be ${headerSize}`,
        );
      } else {
        Logger.warn(
          `Header size mismatch with actual header size. Difference of 4 bytes, assuming header size includes its own field.`,
        );
      }
    }
    return header;
  }
}
