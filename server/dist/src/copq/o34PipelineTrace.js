export function logO34Stage(stage, payload, keysSource) {
    console.log(stage, payload);
    if (keysSource && typeof keysSource === 'object') {
        console.log('AVAILABLE KEYS', Object.keys(keysSource));
    }
}
