import { info, setFailed } from '@actions/core';
import { exec } from '@actions/exec';
import { findFileByExtension } from '../../common/findFileByExtension.js';
import { checkDotNet } from '../../common/checkDotNet.js';
import { getInput } from '../../common/getInput.js';

async function runDotNet(): Promise<void> {
    await checkDotNet();

    const slnFile = await findFileByExtension(process.env.GITHUB_WORKSPACE || process.cwd(), '.slnx');

    if (typeof slnFile !== 'string') {
        throw new Error('No .slnx file found in the repository.');
    }

    const buildConfiguration = getInput('build_configuration', 'Debug');

    info(`Build Configuration: ${buildConfiguration}`);

    await exec('dotnet', ['restore', slnFile]);
    await exec('dotnet', ['build', slnFile, '--no-restore', '--nologo', '-c', buildConfiguration]);
    await exec('dotnet', ['test', slnFile, '--no-build', '--no-restore', '--nologo', '-c', buildConfiguration]);
}

runDotNet()
    .catch(err => {
        setFailed(`Action failed with error: ${err}`);
    });
