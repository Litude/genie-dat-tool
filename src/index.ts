import { decompressFile } from "./deflate";
import BufferReader from "./BufferReader";
import { WorldDatabase } from "./database/WorldDatabase";
import { Logger } from "./Logger";

const VERSION_REGEX = /VER\s+(\d+\.\d+)/

function parseVersion(input: string) {
    const match = input.match(VERSION_REGEX);

    if (match && match[1]) {
        return +match[1];
    }
    else {
        return null;
    }
}

const SupportedDatVersions = [
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
    const version = parseVersion(headerString);
    if (version && SupportedDatVersions.includes(version)) {
        const worldDatabase = new WorldDatabase(dataBuffer, { version });
        worldDatabase.writeToWorldTextFile();
    }
    else if (version) {
        Logger.error(`Detected unsupported version ${version}`)
    }
    else {
        Logger.error(`Input does not seem to be a valid DAT file`);
    }
}

main();

