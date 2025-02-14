import { Logger } from "../Logger";

export function createReferenceIdFromString(input: string) {
  const invalidChars = /[<>:"/\\|?*]/g; // Invalid Windows filename characters
  const sanitized = input.replace(invalidChars, "-");
  const noSpaces = sanitized.replaceAll(" ", "_");
  const noExtension = noSpaces.replace(/\.[^/.]+$/, "");
  const trimmed = noExtension.trim().replace(/\.+$/, "");
  return trimmed;
}

export type ReferenceType =
  | "Terrain"
  | "SoundEffect"
  | "ObjectPrototype"
  | "Sprite"
  | "Border"
  | "Technology"
  | "StateEffect"
  | "Habitat"
  | "Overlay";

function getShortRefName(type: ReferenceType) {
  switch (type) {
    case "Border":
      return "Bdr";
    case "Terrain":
      return "Terr";
    case "SoundEffect":
      return "Snd";
    case "ObjectPrototype":
      return "Obj";
    case "Sprite":
      return "Spr";
    case "Technology":
      return "Tech";
    case "StateEffect":
      return "Eff";
    case "Habitat":
      return "Hab";
    case "Overlay":
      return "Ovly";
    default:
      throw new Error(`Unknown ref type ${type}`);
  }
}

export function createReferenceString(
  type: ReferenceType,
  input: string | undefined,
  fallBackId: number,
) {
  if (input) {
    return `ref${getShortRefName(type)}$${input}`;
  } else {
    let resultId: number | null = null;
    // Borders and overlays use 0 as none, otherwise -1 is used
    if (type === "Border" || type === "Overlay") {
      resultId = fallBackId > 0 ? fallBackId : null;
    } else {
      resultId = fallBackId >= 0 ? fallBackId : null;
    }
    if (typeof resultId === "number") {
      // There are some legit broken references as well...
      Logger.warn(
        `Could not find ${type} with id ${fallBackId} while creating references!`,
      );
    }
    return resultId;
  }
}

export function getIdFromReferenceString<T extends number>(
  type: ReferenceType,
  referencingResource: string,
  input: string | number | null,
  referenceMap: Record<string, number>,
): T {
  if (input === null) {
    return (type === "Border" || type === "Overlay" ? 0 : -1) as T;
  } else if (typeof input === "number") {
    return input as T;
  } else {
    const [prefix, value] = input.split("$");
    const actualPrefix = `ref${getShortRefName(type)}`;
    if (prefix !== actualPrefix) {
      throw new Error(
        `Resource ${referencingResource} has invalud data reference ${input}, expected a ${actualPrefix} prefix!`,
      );
    } else {
      const result: number | undefined = referenceMap[value];
      if (result === undefined) {
        throw new Error(
          `Resource ${referencingResource} references ${input} but no such entry exists!`,
        );
      }
      return result as T;
    }
  }
}

function ensureEntryReferenceIdUniqueness(
  data: { referenceId: string },
  usedIds: Map<string, (typeof data)[]>,
) {
  const currentEntries = usedIds.get(data.referenceId);
  if (currentEntries === undefined) {
    usedIds.set(data.referenceId, [data]);
  } else {
    const originalId = data.referenceId;
    console.log(`Duplicate ref id ${data.referenceId}`);
    data.referenceId = `${data.referenceId}_${currentEntries.length}`;
    if (currentEntries.length === 1) {
      currentEntries[0].referenceId = `${originalId}_0`;
    }
    currentEntries.push(data);
  }
}

export function ensureReferenceIdUniqueness(
  data: ({ referenceId: string } | null)[],
) {
  const usedIds: Map<string, { referenceId: string }[]> = new Map();
  data.forEach((entry) => {
    if (entry) {
      ensureEntryReferenceIdUniqueness(entry, usedIds);
    }
  });
}
