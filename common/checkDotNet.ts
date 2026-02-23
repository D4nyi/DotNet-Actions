import { info } from "@actions/core";
import { exec } from "@actions/exec";

export async function checkDotNet(): Promise<void> {
    const dotnetInstalled = await exec("which dotnet", null!, { ignoreReturnCode: true });

    info(`.NET Installed: ${!dotnetInstalled}`);

    if (dotnetInstalled !== 0) {
        throw new Error(".NET CLI is not installed or not found in PATH.");
    }
}
