import { decompressFile } from "./deflate";
import BufferReader from "./BufferReader";
import { WorldDatabase } from "./database/WorldDatabase";
import { Logger } from "./Logger";
import { Version } from "./database/Version";
import { isDefined } from "./ts/ts-utils";

const VERSION_REGEX = /VER\s+(\d+\.\d+)/

function parseVersion(input: string) {
    const match = input.match(VERSION_REGEX);

    if (match && match[1]) {
        return match[1];
    }
    else {
        return null;
    }
}

const SupportedDatVersions = [
    1.3, // TODO: There are actually two different revisions of this, can it somehow be detected?
    1.4, // TODO: There is a special Mickey flavor of this
    1.5,
    2.7,
    3.1, // TODO: There are actually two different revisions of this, can it somehow be detected?
    3.2, // untested
    3.3,
    3.4, // TODO: later trial version identify as 3.4 but are actually 3.7... (Also no known differences between version 3.3 and 3.4?!)
    3.5,
    3.7
]

function main() {
    const dataBuffer = new BufferReader(decompressFile("empires.dat"));
    const headerString = dataBuffer.readFixedSizeString(8);
    const versionNumber = parseVersion(headerString);
    if (versionNumber && SupportedDatVersions.includes(+versionNumber)) {
        Logger.info(`DAT file identifies itself as version ${versionNumber}`);
        // TODO: Could support multiple potential versions and if an error occurs, try the next version

        const version: Version = {
            numbering: `${versionNumber}.0`,
        };

        Logger.info(`Attempting to parse file as version ${[version.numbering, version.flavor].filter(isDefined).join('-')}`);

        const worldDatabase = new WorldDatabase(dataBuffer, { version });
        worldDatabase.writeToWorldTextFile({ version });
    }
    else if (versionNumber) {
        Logger.error(`Detected unsupported version ${versionNumber}`)
    }
    else {
        Logger.error(`Input does not seem to be a valid DAT file`);
    }
}

main();

