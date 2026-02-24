import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function findFileByExtension(dir: string, extension: string): Promise<string | string[] | null> {
    const elements = await readdir(dir, { withFileTypes: true });

    const grouped = Object.groupBy(elements, element => {
        const name = element.name;

        if (name !== 'bin' && name !== 'obj' && name !== '.git' && element.isDirectory()) {
            return 'directories';
        }

        if (name.endsWith(extension)) {
            return 'files';
        }

        return 'excluded';
    });

    if (Array.isArray(grouped.files) && grouped.files.length > 0) {
        return join(grouped.files[0].parentPath, grouped.files[0].name);
    }

    if (!Array.isArray(grouped.directories) || grouped.directories.length === 0) {
        return null;
    }

    const results: string[] = [];

    for (const element of grouped.directories) {
        const subResult = await findFileByExtension(join(element.parentPath, element.name), extension);

        if (typeof subResult === 'string') {
            results.push(subResult);
        } else if (Array.isArray(subResult)) {
            results.push(...subResult);
        }
    }

    return results;
}
