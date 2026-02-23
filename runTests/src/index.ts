import { info, getInput, setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import { findFileByExtension } from "../../common/findFileByExtension.js";
import { checkDotNet } from "../../common/checkDotNet.js";

async function runDotNet(): Promise<void> {
    await checkDotNet();

    const slnFile = findFileByExtension(process.env.GITHUB_WORKSPACE || process.cwd(), ".slnx");

    if (typeof slnFile !== "string") {
        setFailed("No .slnx file found in the repository.");
        return;
    }

    const buildConfiguration = getInput("build-configuration") || "Debug";

    info(`Build Configuration: ${buildConfiguration}`);

    await exec("dotnet", ["restore", slnFile]);
    await exec("dotnet", ["build", slnFile, "--no-restore", "--nologo", "-c", buildConfiguration]);
    await exec("dotnet", ["test", slnFile, "--no-build", "--no-restore", "--nologo", "-c", buildConfiguration]);
}

runDotNet();
