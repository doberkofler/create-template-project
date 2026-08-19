import fs from 'node:fs/promises';
import path from 'node:path';
import {execa} from 'execa';

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'src/config/dependencies.json');

type DependencyUpdate = {
	pkg: string;
	currentVersion: string;
	latestVersion: string;
	latestAgeInDays: number;
	updateVersion: string;
	updateAgeInDays: number;
};

type TooYoungDependency = {
	pkg: string;
	currentVersion: string;
	latestVersion: string;
	latestAgeInDays: number;
};

type DependencyEntry = {
	version: string;
	description: string;
	fixed?: boolean;
};

type Dependencies = Record<string, DependencyEntry>;

type Config = {
	dependencies: Dependencies;
};

type VersionInfo = {
	latestVersion: string;
	latestAgeInDays: number;
	versions: {version: string; ageInDays: number}[];
};

type NpmViewResponse = {
	version?: string;
	time?: Record<string, string>;
	versions?: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toRecordOfStrings = (value: unknown): Record<string, string> | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}
	const record: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === 'string') {
			record[key] = entry;
		}
	}
	return record;
};

const parseConfig = (raw: string): Config => {
	const parsed = JSON.parse(raw) as unknown;
	if (!isRecord(parsed) || !isRecord(parsed.dependencies)) {
		throw new Error('Invalid dependencies config format.');
	}

	const dependencies: Dependencies = {};
	for (const [name, value] of Object.entries(parsed.dependencies)) {
		if (!isRecord(value)) {
			continue;
		}

		const {version, description, fixed} = value;
		if (typeof version === 'string' && typeof description === 'string') {
			const entry: DependencyEntry = {version, description};
			if (typeof fixed === 'boolean') {
				entry.fixed = fixed;
			}
			dependencies[name] = entry;
		}
	}

	return {dependencies};
};

const toNpmViewResponse = (data: Record<string, unknown>): NpmViewResponse => ({
	version: typeof data.version === 'string' ? data.version : undefined,
	time: toRecordOfStrings(data.time),
	versions: Array.isArray(data.versions) ? data.versions.filter((item): item is string => typeof item === 'string') : undefined,
});

const parseNpmViewResponse = (raw: string): NpmViewResponse => {
	const parsed = JSON.parse(raw) as unknown;
	if (Array.isArray(parsed)) {
		const list = parsed as unknown[];
		const data = list.at(-1);
		return isRecord(data) ? toNpmViewResponse(data) : {};
	}
	return isRecord(parsed) ? toNpmViewResponse(parsed) : {};
};

const ageInDays = (releaseDate: string): number => {
	const date = new Date(releaseDate);
	return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
};

const isStable = (version: string): boolean => !version.includes('-');

const getVersionInfo = async (packageName: string): Promise<VersionInfo | null> => {
	try {
		const {stdout} = await execa('npm', ['view', packageName, 'version', 'time', 'versions', '--json']);
		const data = parseNpmViewResponse(stdout);

		const {version: latestVersion, time: timeObj, versions} = data;
		if (typeof latestVersion !== 'string' || !isRecord(timeObj) || !Array.isArray(versions)) {
			return null;
		}

		const latestReleaseDate = timeObj[latestVersion];
		if (typeof latestReleaseDate !== 'string') {
			return null;
		}

		const versionsWithAge = versions
			.filter((version): version is string => typeof version === 'string' && isStable(version))
			.filter((version) => typeof timeObj[version] === 'string')
			.map((version) => ({version, ageInDays: ageInDays(timeObj[version])}));

		return {
			latestVersion,
			latestAgeInDays: ageInDays(latestReleaseDate),
			versions: versionsWithAge,
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error fetching version for ${packageName}: ${message}`);
		return null;
	}
};

const stripPrefix = (version: string): string => version.replace(/^[\^~]/u, '');

const findUpdateVersion = (info: VersionInfo, currentVersion: string, minReleaseAge: number): {version: string; ageInDays: number} | null => {
	const currentIndex = info.versions.findIndex((entry) => entry.version === currentVersion);

	for (let index = info.versions.length - 1; index > currentIndex; index--) {
		const entry = info.versions[index];
		if (entry.ageInDays >= minReleaseAge) {
			return entry;
		}
	}

	return null;
};

const formatTable = (rows: string[][]): void => {
	const widths = rows[0].map((_, columnIndex) => Math.max(...rows.map((row) => row[columnIndex].length)));
	for (const row of rows) {
		console.log(row.map((cell, columnIndex) => cell.padEnd(widths[columnIndex])).join('  '));
	}
};

const main = async (): Promise<void> => {
	const args = process.argv.slice(2);
	const updateMode = args.includes('--update');
	let minReleaseAge = 1;
	const minAgeIndex = args.indexOf('--min-release-age');
	if (minAgeIndex !== -1 && minAgeIndex + 1 < args.length) {
		const parsed = Number.parseInt(args[minAgeIndex + 1], 10);
		if (!Number.isNaN(parsed)) {
			minReleaseAge = parsed;
		}
	}

	console.log(`Reading dependencies from ${configPath}...`);
	const config = parseConfig(await fs.readFile(configPath, 'utf8'));
	const {dependencies} = config;
	const packageNames = Object.keys(dependencies);

	console.log(`Checking ${packageNames.length} dependencies with a minimum release age of ${minReleaseAge} days ...\n`);

	const fixedDependencies = packageNames.filter((pkg) => dependencies[pkg].fixed === true);
	const updatablePackages = packageNames.filter((pkg) => dependencies[pkg].fixed !== true);

	const results = await Promise.all(
		updatablePackages.map(async (pkg): Promise<DependencyUpdate | TooYoungDependency | null> => {
			const currentVersionStr = dependencies[pkg].version;
			const currentVersion = stripPrefix(currentVersionStr);

			const info = await getVersionInfo(pkg);
			if (info === null || info.latestVersion === currentVersion) {
				return null;
			}

			const latest: TooYoungDependency = {
				pkg,
				currentVersion: currentVersionStr,
				latestVersion: info.latestVersion,
				latestAgeInDays: info.latestAgeInDays,
			};

			const updateVersion = findUpdateVersion(info, currentVersion, minReleaseAge);
			if (updateVersion === null) {
				return latest;
			}

			return {
				...latest,
				updateVersion: updateVersion.version,
				updateAgeInDays: updateVersion.ageInDays,
			};
		}),
	);

	const updates = results.filter((item): item is DependencyUpdate => item !== null && 'updateVersion' in item);
	const tooYoung = results.filter((item): item is TooYoungDependency => item !== null && !('updateVersion' in item));

	if (fixedDependencies.length > 0) {
		console.log('Fixed dependencies (not updated automatically):');
		formatTable([['Package', 'Version'], ...fixedDependencies.map((pkg) => [pkg, dependencies[pkg].version])]);
		console.log('');
	}

	if (updateMode) {
		if (updates.length > 0) {
			console.log(`Updating ${updates.length} dependencies...`);
			for (const update of updates) {
				console.log(`Updating ${update.pkg}: ${update.currentVersion} -> ${update.updateVersion}`);
				dependencies[update.pkg].version = update.updateVersion;
			}
		} else {
			console.log('No updates applied.');
		}

		if (tooYoung.length > 0) {
			console.log(`\nSkipped ${tooYoung.length} dependencies (younger than ${minReleaseAge} days):`);
			for (const update of tooYoung) {
				console.log(`- ${update.pkg} (Current: ${update.currentVersion}, Latest: ${update.latestVersion}, Age: ${update.latestAgeInDays} days)`);
			}
		}

		if (fixedDependencies.length > 0) {
			console.log(`\nSkipped ${fixedDependencies.length} fixed dependencies: ${fixedDependencies.join(', ')}`);
		}

		if (updates.length > 0) {
			await fs.writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`);
			console.log('Dependencies updated successfully.');
		}
		return;
	}

	if (updates.length > 0) {
		console.log('Available updates:');
		formatTable([
			['Package', 'Current', 'Latest', 'Latest Age', 'Update To', 'Update Age'],
			...updates.map((update) => [
				update.pkg,
				update.currentVersion,
				update.latestVersion,
				update.latestAgeInDays.toString(),
				update.updateVersion,
				update.updateAgeInDays.toString(),
			]),
		]);
	}

	if (tooYoung.length > 0) {
		if (updates.length > 0) {
			console.log('');
		}
		console.log(`Available but younger than ${minReleaseAge} days:`);
		formatTable([
			['Package', 'Current', 'Latest', 'Age (days)'],
			...tooYoung.map((update) => [update.pkg, update.currentVersion, update.latestVersion, update.latestAgeInDays.toString()]),
		]);
	}

	if (updates.length === 0 && tooYoung.length === 0 && fixedDependencies.length === 0) {
		console.log('All dependencies are up to date.');
	}

	if (updates.length > 0) {
		console.log('\nRun with --update option to apply changes.');
	}
};

await main();
