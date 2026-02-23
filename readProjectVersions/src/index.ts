import { info, warning, setFailed, setOutput } from "@actions/core";
import { readdir, readFile } from 'node:fs/promises';
import { sep, join, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { ignoreCaseCompare, isStringNullOrWhitespace } from "../../common/stringUtils";
import { Versions } from "../../common/types";
import { getInput } from "../../common/getInput";
import { exec } from "@actions/exec";

async function findCsprojFiles(dir: string): Promise<string | string[]> {
    await exec(`ls -lah ${dir}`);

    const elements = await readdir(dir, { withFileTypes: true });

    const grouped = Object.groupBy(elements, element => {
        if (element.name.endsWith(".csproj")) {
            return "csproj";
        }

        if (element.name !== "bin" && element.name !== "obj" && element.isDirectory()) {
            return "directories";
        }

        return "excluded";
    });

    if (Array.isArray(grouped.csproj) && grouped.csproj.length > 0) {
        return join(grouped.csproj[0].parentPath, grouped.csproj[0].name);
    }

    if (!Array.isArray(grouped.directories) || grouped.directories.length === 0) {
        return [];
    }

    const results: string[] = [];

    for (const element of grouped.directories) {
        const subResult = await findCsprojFiles(join(element.parentPath, element.name));

        if (typeof subResult === "string") {
            results.push(subResult);
        } else if (Array.isArray(subResult)) {
            results.push(...subResult);
        }
    }

    return results;
}

function extractVersionFromParsedProject(parsed: any): string | null {
    if (!parsed) return null;

    const project = parsed.Project ?? parsed.project;
    if (!project) return null;

    const propertyGroups = project.PropertyGroup ?? project.propertyGroup;
    if (!propertyGroups) return null;

    const isPackable = propertyGroups.IsPackable ?? propertyGroups.isPackable;
    if (!isStringNullOrWhitespace(isPackable) && ignoreCaseCompare(isPackable, "false")) {
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

info(`SourceDir: ${sourceDir}`);

findCsprojFiles(sourceDir)
    .then(files => {
        if (!Array.isArray(files) && files.length === 0) {
            throw new Error('No .csproj files found.');
        }

        return (files as string[]);
    })
    .then(createOutput)
    .catch(err => {
        setFailed(`Action failed with error: ${err}`);
    });
