import { debug } from '@actions/core';
import { exec } from '@actions/exec';

export async function checkDotNet(): Promise<void> {
    const dotnetInstalled = await exec('which dotnet', undefined, { ignoreReturnCode: true });

    debug(`.NET Installed: ${dotnetInstalled === 0 ? 'Yes' : 'No'}`);

    if (dotnetInstalled !== 0) {
        throw new Error('.NET CLI is not installed or not found in PATH.');
    }
}
