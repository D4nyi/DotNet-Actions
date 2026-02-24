/**
 * Checks whether the specified `value` is null or an empty string ('') or only consists of whitespace characters.
 *
 * @static
 * @param {unknown} value The value to check.
 * @returns {boolean} Returns `true` if `value` parameter is null or an empty string or only consists of whitespace characters; otherwise `false`.
 */
export function isStringNullOrWhitespace(value: unknown): boolean {
    return Object.prototype.toString.call(value) !== '[object String]' || (value as string).trim() === '';
}

export function ignoreCaseCompare(s1: string, s2: string): boolean {
    return s1.localeCompare(s2, undefined, { sensitivity: 'accent' }) === 0;
}
