/**
 * Checks whether the specified `value` is null or an empty string ("") or only consists of whitespace characters.
 *
 * @static
 * @param {string|null|undefined} value The value to check.
 * @returns {boolean} Returns `true` if `value` parameter is null or an empty string or only consists of whitespace characters; otherwise `false`.
 */
export function isNullOrWhitespace(value: string | null | undefined): boolean {
    return value == null || value.trim() === '';
}


export function isNotNullOrWhitespace(value: string | null | undefined): value is string {
    return !isNullOrWhitespace(value);
}
