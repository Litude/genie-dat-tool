import { decompressFile } from "./deflate";
import BufferReader from "./BufferReader";
import { WorldDatabase } from "./data/WorldDatabase";


function main() {
    const dataBuffer = new BufferReader(decompressFile("empires.dat"));
    const headerString = dataBuffer.readFixedSizeString(8);


    if (headerString === "VER 3.7") {
        console.log('this is a match!')
    }
    console.log(headerString);

    const worldDatabase = new WorldDatabase(dataBuffer, { version: 3.7 });
    //console.log(worldDatabase.toString());
}

main();

