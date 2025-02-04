import JSON5 from 'json5';
import { PathLike, readFileSync } from "fs";
import { asInt16, Int16 } from "../ts/base-types";
import { Logger } from '../Logger';

export class Attribute {
    id: Int16 = asInt16(-1)
    internalName: string = "";
}

export function createDefaultAttribute(index: number): Attribute {
    const attribute = new Attribute();
    attribute.id = asInt16(index);
    attribute.internalName = `ZZZ Attribute ${index}` // ensure unnamed are sorted last
    return attribute;
}

export function readAttributesFromJsonFile(path: PathLike): Attribute[] {
    try {
        const result: Attribute[] = [];
        const rawAttributeData = readFileSync(path);
        if (rawAttributeData) {
            const attributeText = rawAttributeData.toString('latin1')
            const attributes = JSON5.parse(attributeText);
            if (Array.isArray(attributes)) {
                attributes.forEach((attributeName, index) => {
                    if (typeof attributeName === "string") {
                        const attribute = new Attribute()
                        attribute.id = asInt16(index);
                        attribute.internalName = attributeName;
                        if (!attribute.internalName) {
                            attribute.internalName = `ZZZ Attribute ${index}`; // ensure unnamed are sorted last
                        }
                        result.push(attribute);
                    }
                    else {
                        throw new Error(`Unexpected attribute entry ${index}, value is not a string!`)
                    }
                })
            }
        }
        return result;
    } catch (err: unknown) {
        if (err instanceof Error) {
            Logger.error(err.message);
        }
        return [];
    }
}
