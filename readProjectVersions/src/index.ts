import { info, warning, setFailed, setOutput } from '@actions/core';
import { readFile } from 'node:fs/promises';
import { sep, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { ignoreCaseCompare } from '../../common/stringUtils';
import { Versions } from '../../common/types';
import { getInput } from '../../common/getInput';
import { findFileByExtension } from '../../common/findFileByExtension';

function extractVersionFromParsedProject(parsed: any): string | null {
    if (!parsed) return null;

    const project = parsed.Project ?? parsed.project;
    if (!project) return null;

    const propertyGroups = project.PropertyGroup ?? project.propertyGroup;
    if (!propertyGroups) return null;

    const isPackable = propertyGroups.IsPackable ?? propertyGroups.isPackable;
    if (ignoreCaseCompare(isPackable, 'false')) {
        return null;
    }

    return propertyGroups.Version ?? propertyGroups.version;
}

async function getVersionFromCsproj(filePath: string): Promise<string | null> {
    try {
        const xml = await readFile(filePath, 'utf-8');
        const parser = new XMLParser({ ignoreAttributes: true });
        const parsed = parser.parse(xml);
        return extractVersionFromParsedProject(parsed);
    } catch (err) {
        warning(`Failed to parse ${filePath}: ${err}`);
        return null;
    }
}

function getFileName(filePath: string): string {
    const slash = filePath.lastIndexOf(sep);
    let dot = filePath.lastIndexOf('.');

    if (dot === -1) {
        dot = filePath.length;
    }

    return filePath.substring(slash + 1, dot);
}

async function createOutput(files: string[]) {
    const versions: Versions = {};

    for (const file of files) {
        const version = await getVersionFromCsproj(file);

        const fileName = getFileName(file);

        if (version) {
            info(`${fileName} -> Version: ${version}`);

            versions[fileName] = version;
        } else {
            warning(`${fileName} -> Version: (not found)`);
        }
    }

    setOutput('versions', JSON.stringify(versions));
}

const sourceDir = resolve(getInput('source_dir', process.cwd()));

findFileByExtension(sourceDir, '.csproj')
    .then(files => {
        if (!Array.isArray(files) || files.length === 0) {
            throw new Error('No .csproj files found.');
        }

        return files as string[];
    })
    .then(createOutput)
    .catch(err => {
        setFailed(`Action failed with error: ${err}`);
    });
