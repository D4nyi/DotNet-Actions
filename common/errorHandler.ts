import { setFailed } from '@actions/core';

export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }

    return err?.toString() ?? "Unknown error!";
}

export function errorHandler(err: unknown) {
    const message = getErrorMessage(err);

    setFailed(`Action failed with error: ${message}`);
}
