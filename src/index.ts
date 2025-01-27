import { decompressFile } from "./deflate";
import BufferReader from "./BufferReader";
import { WorldDatabase } from "./database/WorldDatabase";
import { Logger } from "./Logger";
import { Version } from "./database/Version";

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

const SupportedDatVersions = {
    "1.3": ["1.3.0", "1.3.1"], // There are actually two different revisions of 1.3
    "1.4": ["1.4.0", "1.4.0-mickey"], // There is a special Mickey flavor of 1.4
    "1.5": ["1.5.0"],
    "2.7": ["2.7.0"],
    "3.1": ["3.1.0", "3.1.1"], // There are actually two different revisions of 3.1
    "3.2": ["3.2.0"],
    "3.3": ["3.3.0"],
    "3.4": ["3.4.0", "3.7.0"], // Later trial version identify as 3.4 but are actually 3.7
    "3.5": ["3.5.0"],
    "3.7": ["3.7.0"],
};

function isSupportedDatVersion(version: string): version is keyof (typeof SupportedDatVersions) {
    return Object.keys(SupportedDatVersions).includes(version);
}

function main() {
    const inputFilename = process.argv[2] ?? "empires.dat";
    const dataBuffer = new BufferReader(decompressFile(inputFilename));
    const headerString = dataBuffer.readFixedSizeString(8);
    const versionNumber = parseVersion(headerString);
    if (versionNumber && isSupportedDatVersion(versionNumber)) {
        Logger.info(`DAT file identifies itself as version ${versionNumber}`);
        const potentialVersions = SupportedDatVersions[versionNumber];

        let worldDatabase: WorldDatabase | null = null;
        let version: Version | null = null;

        for (let i = 0; i < potentialVersions.length; ++i) {
            const parsingVersion = potentialVersions[i];
            const [numbering, flavor] = parsingVersion.split('-');
            dataBuffer.seek(8);
            version = {
                numbering: numbering,
                flavor,
            };

            Logger.info(`Attempting to parse file as version ${parsingVersion}`);
            worldDatabase = new WorldDatabase();
            if (worldDatabase.readFromBuffer(dataBuffer, { version, abortOnError: i !== potentialVersions.length - 1, cleanedData: false } )) {
                Logger.info("File parsed successfully");
                break;
            }
            else {
                Logger.error(`Parsing file as version ${parsingVersion} failed!`);
            }
        }
        if (worldDatabase && version) {
            worldDatabase.writeToWorldTextFile({ version });
        }

    }
    else if (versionNumber) {
        Logger.error(`Detected unsupported version ${versionNumber}`)
    }
    else {
        Logger.error(`Input does not seem to be a valid DAT file`);
    }
}

main();
