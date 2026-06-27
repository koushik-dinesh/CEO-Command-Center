export function parseJsonField(value) {
    if (typeof value === 'string')
        return JSON.parse(value);
    return value;
}
export function stringifyJson(value) {
    return JSON.stringify(value ?? null);
}
