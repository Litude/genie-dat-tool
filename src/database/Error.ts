import { Logger } from "../Logger";

export class ParsingError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function onParsingError(
  message: string,
  loadingContext: { abortOnError: boolean },
) {
  if (loadingContext.abortOnError) {
    throw new ParsingError(message);
  } else {
    Logger.warn(message);
  }
}
