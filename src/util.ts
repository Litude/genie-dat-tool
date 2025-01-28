import { onParsingError } from "./database/Error";
import { ReferenceType } from "./json/filenames";
import { Logger } from "./Logger";

export function getDataEntry<T>(entries: T[], index: number, resourceType: ReferenceType, referencingResource: string, loadingContext: { abortOnError: boolean }) {
    if (index >= 0) {
        if (index < entries.length) {
            const result = entries[index];
            if (!result && (resourceType !== "Border" || index !== 0)) {
                Logger.info(`INFO: ${referencingResource} references ${resourceType} with id ${index} but no such entry exists!`);
            }
            return result;
        }
        else {
            onParsingError(`Out of bounds access when looking for ${resourceType} id ${index} (entry count is ${entries.length}). File might be corrupt.`, loadingContext);
        }
    }
    return null;
}
