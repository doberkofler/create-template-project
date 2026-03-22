#!/usr/bin/env node
import {Command} from 'commander';
import {SingleBar, Presets} from 'cli-progress';

const program = new Command();
program.name('my-cli').description('A sample CLI');
program.parse();

const bar = new SingleBar({}, Presets.shades_classic);
bar.start(100, 0);
bar.update(50);
bar.stop();

console.log('Hello from CLI template!');
