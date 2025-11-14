// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export type Err = {
    ERR: true
    error: unknown
    type?: ErrTypes
}

type ErrTypes = 'internal' | 'badInput' | 'notFound';

export function isErr(x: unknown): x is Err {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof x === 'object' && x != null && 'ERR' in x;
}

export function Err(message: string, type?: ErrTypes): Err {
    return { ERR: true, error: message, type: type }
}

export async function tryFail<T>(
    f: (() => Promise<T>) | (() => T)
): Promise<T | Err> {
    try {
        return await f()
    } catch (e) {
        return { ERR: true, error: e }
    }
}

export function assertOk<T>(x: T | Err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isErr(x)) throw Error((x.error as any).toString());
}
