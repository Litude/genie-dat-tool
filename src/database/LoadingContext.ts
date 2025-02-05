import { Int16 } from "../ts/base-types";
import { Version } from "./Version";

export interface LoadingContext {
    version: Version;
    abortOnError: boolean;
    cleanedData: boolean;
}

export interface JsonLoadingContext extends LoadingContext {
    terrainCount: number,
    dataIds: {
        habitatIds: Record<string, number>,
        terrainIds: Record<string, number>,
    }
}