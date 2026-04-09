import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execa} from 'execa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'src/config/dependencies.json');

type DependencyUpdate = {
	pkg: string;
	currentVersion: string;
	latestVersion: string;
	ageInDays: number;
};

type DependencyEntry = {
	version: string;
	description: string;
};

type Dependencies = Record<string, DependencyEntry>;

type Config = {
	dependencies: Dependencies;
};

type NpmViewResponse =
	| {
			version?: string;
			time?: Record<string, string>;
	  }
	| {
			version?: string;
			time?: Record<string, string>;
	  }[];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

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

		const {version, description} = value;
		if (typeof version === 'string' && typeof description === 'string') {
			dependencies[name] = {version, description};
		}
	}

	return {dependencies};
};

const parseNpmViewResponse = (raw: string): NpmViewResponse => {
	const parsed = JSON.parse(raw) as unknown;
	if (Array.isArray(parsed) || isRecord(parsed)) {
		return parsed as NpmViewResponse;
	}
	return {};
};

const getLatestVersionInfo = async (packageName: string): Promise<{version: string; ageInDays: number} | null> => {
	try {
		const {stdout} = await execa('npm', ['view', packageName, 'version', 'time', '--json']);
		const data = parseNpmViewResponse(stdout);

		const latest = Array.isArray(data) ? data.at(-1) : data;
		if (!isRecord(latest)) {
			return null;
		}

		const {version, time: timeObj} = latest;
		if (typeof version !== 'string' || !isRecord(timeObj) || typeof timeObj[version] !== 'string') {
			return null;
		}

		const releaseDate = new Date(timeObj[version]);
		const ageInDays = Math.floor((Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
		return {version, ageInDays};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error fetching version for ${packageName}: ${message}`);
		return null;
	}
};

const main = async (): Promise<void> => {
	const args = process.argv.slice(2);
	const updateMode = args.includes('--update');
	let minReleaseAge = 3;
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

	const updatesRaw = await Promise.all(
		packageNames.map(async (pkg): Promise<DependencyUpdate | null> => {
			const currentVersionStr = dependencies[pkg].version;
			const currentVersion = currentVersionStr.replace(/^[\^~]/, '');

			const latestInfo = await getLatestVersionInfo(pkg);
			if (latestInfo === null || latestInfo.version === currentVersion) {
				return null;
			}

			return {
				pkg,
				currentVersion: currentVersionStr,
				latestVersion: latestInfo.version,
				ageInDays: latestInfo.ageInDays,
			};
		}),
	);

	const updates = updatesRaw.filter((item): item is DependencyUpdate => item !== null);

	if (updates.length === 0) {
		console.log('All dependencies are up to date.');
		return;
	}

	if (updateMode) {
		const updatesToApply = updates.filter((u) => u.ageInDays >= minReleaseAge);
		const skippedUpdates = updates.filter((u) => u.ageInDays < minReleaseAge);

		if (updatesToApply.length === 0) {
			console.log(`\nNo updates applied. ${skippedUpdates.length} updates are available but are younger than ${minReleaseAge} days.`);
			return;
		}

		console.log(`Updating ${updatesToApply.length} dependencies...`);
		for (const update of updatesToApply) {
			const newVersion = update.latestVersion;
			console.log(`Updating ${update.pkg}: ${update.currentVersion} -> ${newVersion}`);
			dependencies[update.pkg].version = newVersion;
		}

		if (skippedUpdates.length > 0) {
			console.log(`\nSkipped ${skippedUpdates.length} dependencies (younger than ${minReleaseAge} days):`);
			for (const update of skippedUpdates) {
				console.log(`- ${update.pkg} (Current: ${update.currentVersion}, Latest: ${update.latestVersion}, Age: ${update.ageInDays} days)`);
			}
		}

		await fs.writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`);
		console.log('Dependencies updated successfully.');
		return;
	}

	console.log(`${'Package'.padEnd(40)}${'Current'.padEnd(15)}${'Latest'.padEnd(15)}${'Age (days)'.padEnd(15)}`);
	console.log('-'.repeat(85));
	for (const update of updates) {
		console.log(`${update.pkg.padEnd(40)}${update.currentVersion.padEnd(15)}${update.latestVersion.padEnd(15)}${update.ageInDays.toString().padEnd(15)}`);
	}
	console.log('\nRun with --update option to apply changes.');
};

await main();
