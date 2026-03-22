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

async function getLatestVersion(packageName: string): Promise<string | null> {
	try {
		const {stdout} = await execa('npm', ['view', packageName, 'version']);
		return stdout.trim();
	} catch (error) {
		console.error(`Error fetching version for ${packageName}:`, (error as Error).message);
		return null;
	}
}

async function main() {
	const args = process.argv.slice(2);
	const updateMode = args.includes('--update');

	console.log(`Reading dependencies from ${configPath}...`);
	const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as Config;
	const dependencies = config.dependencies;
	const packageNames = Object.keys(dependencies);

	console.log(`Checking ${packageNames.length} dependencies...`);

	const updates: DependencyUpdate[] = [];

	// Process in batches of 10
	const batchSize = 10;
	for (let i = 0; i < packageNames.length; i += batchSize) {
		const batch = packageNames.slice(i, i + batchSize);

		const promises = batch.map(async (pkg) => {
			const currentVersionStr = dependencies[pkg].version;
			// Simple stripping of ^ and ~
			const currentVersion = currentVersionStr.replace(/^[\^~]/, '');

			const latestVersion = await getLatestVersion(pkg);

			if (latestVersion && latestVersion !== currentVersion) {
				return {
					pkg,
					currentVersion: currentVersionStr,
					latestVersion,
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
		console.log(`Updating ${updates.length} dependencies...`);
		for (const update of updates) {
			const newVersion = `${update.latestVersion}`;
			console.log(`Updating ${update.pkg}: ${update.currentVersion} -> ${newVersion}`);
			dependencies[update.pkg].version = newVersion;
		}

		await fs.writeFile(configPath, JSON.stringify(config, null, '\t') + '\n');
		console.log('Dependencies updated successfully.');
	} else {
		console.log('Available updates:');
		// Simple table output manually for clarity
		console.log('Package'.padEnd(40) + 'Current'.padEnd(15) + 'Latest'.padEnd(15));
		console.log('-'.repeat(70));
		for (const u of updates) {
			console.log(u.pkg.padEnd(40) + u.currentVersion.padEnd(15) + u.latestVersion.padEnd(15));
		}
		console.log('\nRun "npm run update-dependencies" to apply changes.');
	}
}

main().catch(console.error);
