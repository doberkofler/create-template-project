import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execa} from 'execa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'src/config/dependencies.json');

interface DependencyUpdate {
	pkg: string;
	currentVersion: string;
	latestVersion: string;
	ageInDays: number;
}

interface Dependencies {
	[key: string]: {
		version: string;
		description: string;
	};
}

interface Config {
	dependencies: Dependencies;
}

async function getLatestVersionInfo(packageName: string): Promise<{version: string; ageInDays: number} | null> {
	try {
		const {stdout} = await execa('npm', ['view', packageName, 'version', 'time', '--json']);
		const data = JSON.parse(stdout);

		const version = Array.isArray(data) ? data[data.length - 1].version : data.version;
		const timeObj = Array.isArray(data) ? data[data.length - 1].time : data.time;

		if (!version || !timeObj || !timeObj[version]) {
			return null;
		}

		const releaseDate = new Date(timeObj[version]);
		const ageInDays = Math.floor((Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));

		return {version, ageInDays};
	} catch (error) {
		console.error(`Error fetching version for ${packageName}:`, (error as Error).message);
		return null;
	}
}

async function main() {
	const args = process.argv.slice(2);
	const updateMode = args.includes('--update');
	let minReleaseAge = 3;
	const minAgeIndex = args.indexOf('--min-release-age');
	if (minAgeIndex !== -1 && minAgeIndex + 1 < args.length) {
		const parsed = parseInt(args[minAgeIndex + 1], 10);
		if (!Number.isNaN(parsed)) {
			minReleaseAge = parsed;
		}
	}

	console.log(`Reading dependencies from ${configPath}...`);
	const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as Config;
	const dependencies = config.dependencies;
	const packageNames = Object.keys(dependencies);

	console.log(`Checking ${packageNames.length} dependencies with a minimum release age of ${minReleaseAge} days ...\n`);

	const updates: DependencyUpdate[] = [];

	// Process in batches of 10
	const batchSize = 10;
	for (let i = 0; i < packageNames.length; i += batchSize) {
		const batch = packageNames.slice(i, i + batchSize);

		const promises = batch.map(async (pkg) => {
			const currentVersionStr = dependencies[pkg].version;
			// Simple stripping of ^ and ~
			const currentVersion = currentVersionStr.replace(/^[\^~]/, '');

			const latestInfo = await getLatestVersionInfo(pkg);

			if (latestInfo && latestInfo.version !== currentVersion) {
				return {
					pkg,
					currentVersion: currentVersionStr,
					latestVersion: latestInfo.version,
					ageInDays: latestInfo.ageInDays,
				};
			}
			return null;
		});

		const results = await Promise.all(promises);
		updates.push(...results.filter((r): r is DependencyUpdate => r !== null));
	}

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
			const newVersion = `${update.latestVersion}`;
			console.log(`Updating ${update.pkg}: ${update.currentVersion} -> ${newVersion}`);
			dependencies[update.pkg].version = newVersion;
		}

		if (skippedUpdates.length > 0) {
			console.log(`\nSkipped ${skippedUpdates.length} dependencies (younger than ${minReleaseAge} days):`);
			for (const update of skippedUpdates) {
				console.log(`- ${update.pkg} (Current: ${update.currentVersion}, Latest: ${update.latestVersion}, Age: ${update.ageInDays} days)`);
			}
		}

		await fs.writeFile(configPath, JSON.stringify(config, null, '\t') + '\n');
		console.log('Dependencies updated successfully.');
	} else {
		console.log('Package'.padEnd(40) + 'Current'.padEnd(15) + 'Latest'.padEnd(15) + 'Age (days)'.padEnd(15));
		console.log('-'.repeat(85));
		for (const u of updates) {
			console.log(u.pkg.padEnd(40) + u.currentVersion.padEnd(15) + u.latestVersion.padEnd(15) + u.ageInDays.toString().padEnd(15));
		}
		console.log('\nRun with --update option to apply changes.');
	}
}

main().catch(console.error);
