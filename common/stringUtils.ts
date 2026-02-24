/**
 * Checks if `value` is classified as a `String`.
 *
 * @static
 * @param {unknown} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a string; otherwise `false` (including for `null`, `undefined`, non-string types).
 */
export function isString(value: unknown): boolean {
    return Object.prototype.toString.call(value) === '[object String]';
}

/**
 * Checks whether the specified `value` is null or an empty string ('').
 *
 * @static
 * @param {unknown} value The value to check.
 * @returns {boolean} Returns `true` if `value` parameter is null, undefined or an empty string; otherwise `false`.
 */
export function isStringNullOrEmpty(value: unknown): boolean {
    return !isString(value) || (value as string).length === 0;
}

/**
 * Checks whether the specified `value` is null or an empty string ('') or only consists of whitespace characters.
 *
 * @static
 * @param {unknown} value The value to check.
 * @returns {boolean} Returns `true` if `value` parameter is null or an empty string or only consists of whitespace characters; otherwise `false`.
 */
export function isStringNullOrWhitespace(value: unknown): boolean {
    return !isString(value) || (value as string).trim() === '';
}

export function ignoreCaseCompare(s1: string, s2: string): boolean {
    return s1.localeCompare(s2, undefined, { sensitivity: 'accent' }) === 0;
}
