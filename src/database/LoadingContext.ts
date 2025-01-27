import { Version } from "./Version";

export interface LoadingContext {
    version: Version;
    abortOnError: boolean;
    cleanedData: boolean;
}
