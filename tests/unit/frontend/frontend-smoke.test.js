import fs from 'node:fs';
import path from 'node:path';

import ejs from 'ejs';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const PUBLIC_ROOT = path.join(PROJECT_ROOT, 'public');
const JAVASCRIPT_ROOT = path.join(PUBLIC_ROOT, 'js');
const VIEW_ROOT = path.join(PROJECT_ROOT, 'views');

function listFiles(directory, extension) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory())
            return listFiles(entryPath, extension);

        return path.extname(entry.name) === extension ? [entryPath] : [];
    });
}

function relativeProjectPath(file) {
    return path.relative(PROJECT_ROOT, file).replaceAll('\\', '/');
}

function resolvePublicUrl(url) {
    const pathname = url.split(/[?#]/, 1)[0];
    return path.join(PUBLIC_ROOT, pathname.slice(1));
}

// Frontend smoke checks catch broken EJS includes, assets, and module imports.
describe('frontend smoke checks', () => {
    it('compiles every EJS template', () => {
        const failures = [];

        for (const file of listFiles(VIEW_ROOT, '.ejs')) {
            try {
                ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file });
            } catch (error) {
                failures.push(`${relativeProjectPath(file)} -> ${error.message}`);
            }
        }

        expect(failures).toEqual([]);
    });

    it('resolves every relative ES module import', () => {
        const patterns = [
            /\b(?:import|export)\s+(?:[^"']*?\sfrom\s+)?["']([^"']+)["']/g,
            /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
        ];
        const missingImports = [];

        for (const file of listFiles(JAVASCRIPT_ROOT, '.js')) {
            const source = fs.readFileSync(file, 'utf8');

            for (const pattern of patterns) {
                for (const match of source.matchAll(pattern)) {
                    if (!match[1].startsWith('.'))
                        continue;

                    const importedFile = path.resolve(path.dirname(file), match[1]);

                    if (!fs.existsSync(importedFile))
                        missingImports.push(`${relativeProjectPath(file)} -> ${match[1]}`);
                }
            }
        }

        expect(missingImports).toEqual([]);
    });

    it('resolves every literal EJS include target and public asset', () => {
        const missingAssets = [];
        const includePattern = /<%-?\s*include\(\s*["']([^"']+)["']/g;
        const publicUrlPattern = /\/(?:css|fonts|img|js)\/[A-Za-z0-9_./-]+/g;

        for (const file of listFiles(VIEW_ROOT, '.ejs')) {
            const source = fs.readFileSync(file, 'utf8');

            for (const match of source.matchAll(includePattern)) {
                const includePath = path.resolve(
                    path.dirname(file),
                    `${match[1]}.ejs`,
                );

                if (!fs.existsSync(includePath))
                    missingAssets.push(`${relativeProjectPath(file)} -> ${match[1]}`);
            }

            for (const match of source.matchAll(publicUrlPattern)) {
                if (!fs.existsSync(resolvePublicUrl(match[0])))
                    missingAssets.push(`${relativeProjectPath(file)} -> ${match[0]}`);
            }
        }

        expect(missingAssets).toEqual([]);
    });
});
