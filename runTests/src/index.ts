import { info } from '@actions/core';
import { exec } from '@actions/exec';
import { findFileByExtension } from '@common/findFileByExtension.js';
import { checkDotNet } from '@common/checkDotNet.js';
import { getInput } from '@common/getInput.js';
import { errorHandler } from '@common/errorHandler.js';
import { env, cwd } from 'node:process';

async function runDotNet(): Promise<void> {
    await checkDotNet();

    const workspacePath = env['GITHUB_WORKSPACE'] ?? cwd();

    const slnFile = await findFileByExtension(workspacePath, '.slnx');

    if (typeof slnFile !== 'string') {
        throw new Error('No .slnx file found in the repository.');
    }

    const buildConfiguration = getInput('build_configuration', 'Debug');

    info(`Build Configuration: ${buildConfiguration}`);

    await exec('dotnet', ['restore', slnFile]);
    await exec('dotnet', ['build', slnFile, '--no-restore', '--nologo', '-c', buildConfiguration]);
    await exec('dotnet', ['test', slnFile, '--no-build', '--no-restore', '--nologo', '-c', buildConfiguration]);
}

runDotNet().catch(errorHandler);
