import { sprintf } from "sprintf-js"
import { Float32, Int32 } from "./data/Types";

export function formatFloat(input: Float32) {
    const result = sprintf("%-15.6f", input);
    // Original files omitted leading zero, we want to do the same to achieve max compatibility
    if (result.startsWith("0.")) {
        return result.slice(1) + " ";
    }
    else {
        return result;
    }
}

export function formatInteger(input: number) {
    return sprintf("%-7d", input);
}

export function formatString(input: string, maxWidth: number) {
    return sprintf(`%-${maxWidth}s`, input);
}
