import { Logger } from "./Logger";

export function getEntryOrLogWarning<T>(entries: T[], index: number, resourceType: string) {
    if (index >= 0) {
        if (index < entries.length) {
            return entries[index];
        }
        else {
            Logger.warn(`Could not find ${resourceType} id ${index} (entry count is ${entries.length}). File might be corrupt.`)
        }
    }
    return null;
}
