import path from "path";
import { Logger } from "../Logger";
import { writeFileSync } from "fs";

export function createSafeFilenameStem(input: string) {
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g; // Invalid Windows filename characters
    const sanitized = input.replace(invalidChars, "-");
    const noSpaces = sanitized.replaceAll(" ", "_");
    const noExtension = noSpaces.replace(/\.[^/.]+$/, "");
    const trimmed = noExtension.trim().replace(/\.+$/, "");
    return trimmed;
}

export type ReferenceType = "Terrain" | "SoundEffect" | "ObjectPrototype" | "Sprite" | "Border" | "Technology" | "StateEffect" | "Habitat" | "Overlay";

function getShortRefName(type: ReferenceType) {
    switch (type) {
        case "Border":
            return "Bdr";
        case 'Terrain':
            return "Terr";
        case "SoundEffect":
            return "Snd";
        case "ObjectPrototype":
            return "Obj"
        case "Sprite":
            return "Spr";
        case "Technology":
            return "Tech";
        case "StateEffect":
            return "Eff";
        case "Habitat":
            return "Hab";
        case "Overlay":
            return "Ovly"
        default:
            throw new Error(`Unknown ref type ${type}`)
    }
}

export function createReferenceString(type: ReferenceType, input: string | undefined, fallBackId: number) {
    if (input) {
        return `ref${getShortRefName(type)}$${input}`
    }
    else {
        let resultId: number | null = null;
        if (type === "Border") {
            resultId = fallBackId > 0 ? fallBackId : null;
        }
        else {
            resultId = fallBackId >= 0 ? fallBackId : null;
        }
        if (typeof resultId === "number") {
            // There are some legit broken references as well...
            Logger.warn(`Could not find ${type} with ${fallBackId} while creating references!`)
        }
        return resultId;
    }
}

// TODO: Is there a risk that we get some other value than what it was originally when reading back these values?
// Need to read them back using Math.fround and probably check the data to see if errors accumulate..
export function jsonNumberCleanup(key: string, value: any) {
    return typeof value === "number" ? parseFloat(value.toFixed(6)) : value
}

function ensureEntryReferenceIdUniqueness(data: { referenceId: string }, usedIds: Map<string, (typeof data)[]>) {
    const currentEntries = usedIds.get(data.referenceId)
    if (currentEntries === undefined) {
        usedIds.set(data.referenceId, [data]);
    }
    else {
        const originalId = data.referenceId;
        console.log(`Duplicate ref id ${data.referenceId}`);
        data.referenceId = `${data.referenceId}_${currentEntries.length}`;
        if (currentEntries.length === 1) {
            currentEntries[0].referenceId = `${originalId}_0`
        }
        currentEntries.push(data);
    }
}

export function ensureReferenceIdUniqueness(data: ({ referenceId: string } | null)[]) {
    const usedIds: Map<string, ({ referenceId: string })[]> = new Map();
    data.forEach(entry => {
        if (entry) {
            ensureEntryReferenceIdUniqueness(entry, usedIds);
        }
    })
}

export function createJson(value: any) {
    return JSON.stringify(value, jsonNumberCleanup, 4);
}

export function writeJsonFileIndex(outputDirectory: string, entries: ({ referenceId: string} | null)[]) {
    const referenceIds = entries.map(entry => entry?.referenceId ?? null);
    writeFileSync(path.join(outputDirectory, "index.json"), createJson(referenceIds));
}
