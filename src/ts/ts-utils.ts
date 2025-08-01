export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function isDefined<T>(
  argument: T | null | undefined,
): argument is NonNullable<T> {
  return argument !== undefined && argument !== null;
}

export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

export type Nullable<T> = T | null;

export function trimEnd<T>(arr: T[], predicate: (value: T) => boolean): T[] {
  let i = arr.length;

  while (i > 0 && predicate(arr[i - 1])) {
    i--;
  }

  return arr.slice(0, i);
}

export function forEachObjectEntry<T extends object>(
  obj: T,
  callback: (key: keyof T, value: T[keyof T]) => void,
) {
  Object.entries(obj).forEach(([key, value]) => {
    callback(key as keyof T, value as T[keyof T]);
  });
}

export type PropertiesOnly<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
