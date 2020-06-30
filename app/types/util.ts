import { AssertionError } from 'assert';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isString = (value: any): value is string => {
  return typeof value === 'string' || value instanceof String;
};
export function assertIsDefined<T>(val: T): asserts val is NonNullable<T> {
  if (val === undefined || val === null) {
    throw new AssertionError({
      message: `Expected 'val' to be defined, but received ${val}`
    });
  }
}
