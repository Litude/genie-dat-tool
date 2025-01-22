export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function isDefined<T>(argument: T | null | undefined): argument is NonNullable<T> {
    return argument !== undefined && argument !== null;
}
