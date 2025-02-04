import { sprintf } from "sprintf-js";
import { Float32, Float64, Int16, Int32, Int8, UInt16, UInt32, UInt8 } from "../ts/base-types";
import { EOL } from "os";
import { createWriteStream, PathLike, WriteStream } from "fs";
import { Logger } from "../Logger";

export class TextFileWriter {
    stream: WriteStream;
    buffer: string[] = [];

    constructor(filename: PathLike) {
        this.stream = createWriteStream(filename)
    }

    raw(input: number | string) {
        this.buffer.push(input.toString());
        return this;
    }

    indent(amount: number) {
        this.buffer.push(" ".repeat(amount));
        return this;
    }

    integer(input: Int8 | Int16 | Int32 | UInt8 | UInt16 | UInt32 | number & { __brand?: never }) {
        this.buffer.push(sprintf("%-7d", input));
        return this;
    }

    float(input: Float32) {
        let result = sprintf("%-15.6f", input);
        // Original files omitted leading zero, we want to do the same to achieve max compatibility
        if (result.startsWith("0.") && result !== "0.000000       ") {
            result = result.slice(1) + " ";
        }
        else if (result.startsWith("-0.")) {
            result = "-" + result.slice(2) + " ";
        }
        this.buffer.push(result);
        return this;

    }

    filename(input: string) {
        let parsedInput = input;
        const extensionLocation = input.indexOf(".");
        if (extensionLocation !== -1) {
            parsedInput = input.slice(0, extensionLocation);
        }
        if (parsedInput.length > 8) {
            Logger.warn(`Filename ${parsedInput} is too long and will be truncated!`);
        }
        parsedInput = parsedInput.slice(0, 8);
        this.buffer.push(sprintf(`%-9s`, parsedInput));
        return this;
    }

    string(input: string, maxWidth: number) {
        let parsedInput = input;
        if (input.length > maxWidth - 1) {
            Logger.warn(`Output string ${input} is too long and will be truncated!`);
            parsedInput = input.slice(0, maxWidth - 1);
        }
        this.buffer.push(sprintf(`%-${maxWidth}s`, parsedInput));
        return this;
    }

    structure(writerFunction: ((writer: TextFileWriter) => void)) {
        writerFunction(this);
        return this;
    }

    conditional(result: boolean, func: (arg: TextFileWriter) => void) {
        if (result) {
            func(this);
        }
        return this;
    }

    eol() {
        // TODO: Should this always be \r\n?
        this.buffer.push(EOL);
        this.stream.write(this.buffer.join(""));
        this.buffer = [];
        return this;
    }

    close() {
        if (this.buffer.length) {
            this.eol();
        }
        this.stream.close();
    }
}
