import fs from "fs";
import path from "path";
import { ResourceId } from "../database/Types";
import { Logger } from "../Logger";
import { PropertiesOnly } from "../ts/ts-utils";

export class FileEntry {
  data: Buffer;
  resourceId?: ResourceId;
  filename: string;
  modificationTime: number;

  constructor(inputData: PropertiesOnly<FileEntry>) {
    this.data = inputData.data;
    this.resourceId = inputData.resourceId;
    this.filename = inputData.filename;
    this.modificationTime = inputData.modificationTime;
  }

  writeToFile(directory: string) {
    if (!this.filename) {
      throw new Error("Filename is required to write the file.");
    }
    if (!this.data) {
      throw new Error("No data available to write to the file.");
    }

    try {
      const filePath = path.join(directory, this.filename);
      fs.writeFileSync(filePath, this.data);

      if (this.modificationTime !== undefined) {
        // Must pass this as date to get millisecond precision, plain numbers are treated as seconds
        const modificationTime = new Date(this.modificationTime);
        fs.utimesSync(filePath, modificationTime, modificationTime);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        Logger.error(`Error writing file ${this.filename}: ${err.message}`);
      } else {
        Logger.error(`Error writing file ${this.filename}`);
      }
    }
  }
}
