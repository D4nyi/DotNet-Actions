import { getInput as _getInput } from "@actions/core";

export function getRequiredInput(key: string): string {
    return _getInput(key, { required: true });
}

export function getInput(key: string, defaultValue: string): string {
    return _getInput(key, { required: false }) || defaultValue;
}
