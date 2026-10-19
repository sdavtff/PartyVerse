export const dbStatus = {
    state: 'off',
    error: null,
    since: Date.now(),
};
export function setDbState(state, error = null) {
    dbStatus.state = state;
    dbStatus.error = error;
    dbStatus.since = Date.now();
}
/** Rejeita se a promessa demorar mais que `ms`. */
export function withTimeout(p, ms, onTimeout) {
    let t;
    return Promise.race([
        p.finally(() => clearTimeout(t)),
        new Promise((_, rej) => {
            t = setTimeout(() => rej(onTimeout()), ms);
            t.unref?.();
        }),
    ]);
}
