#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const meow = require('meow');
const appdmg = require('appdmg');
const plist = require('plist');
const Ora = require('ora');
const execa = require('execa');

if (process.platform !== 'darwin') {
	console.error('macOS only');
	process.exit(1);
}

const cli = meow(`
	Usage
	  $ create-dmg <app> [destination]

	Options
	  --overwrite  Overwrite existing DMG with the same name

	Examples
	  $ create-dmg 'Lungo.app'
	  $ create-dmg 'Lungo.app' Build/Releases
`, {
	flags: {
		overwrite: {
			type: 'boolean'
		}
	}
});

let [appPath, destPath] = cli.input;

if (!appPath) {
	console.error('Specify an app');
	process.exit(1);
}

if (!destPath) {
	destPath = process.cwd();
}

let infoPlist;
try {
	infoPlist = fs.readFileSync(path.join(appPath, 'Contents/Info.plist'), 'utf8');
} catch (error) {
	if (error.code === 'ENOENT') {
		console.error(`Could not find \`${path.relative(process.cwd(), appPath)}\``);
		process.exit(1);
	}

	throw error;
}

const appInfo = plist.parse(infoPlist);
const appName = appInfo.CFBundleDisplayName || appInfo.CFBundleName;
// `const appIconName = appInfo.CFBundleIconFile.replace(/\.icns/, '');
const dmgPath = path.join(destPath, `${appName} ${appInfo.CFBundleShortVersionString}.dmg`);

const ora = new Ora('Creating DMG');
ora.start();

if (cli.flags.overwrite) {
	try {
		fs.unlinkSync(dmgPath);
	} catch (_) {}
}

const ee = appdmg({
	target: dmgPath,
	basepath: process.cwd(),
	specification: {
		title: appName,
		// Disabled because of #16
		// icon: path.join(appPath, 'Contents/Resources', `${appIconName}.icns`),
		//
		// Use transparent background and `background-color` option when this is fixed:
		// https://github.com/LinusU/node-appdmg/issues/135
		background: path.join(__dirname, 'assets/dmg-background.png'),
		'icon-size': 160,
		format: 'ULFO',
		window: {
			size: {
				width: 660,
				height: 400
			}
		},
		contents: [
			{
				x: 180,
				y: 170,
				type: 'file',
				path: appPath
			},
			{
				x: 480,
				y: 170,
				type: 'link',
				path: '/Applications'
			}
		]
	}
});

ee.on('progress', info => {
	if (info.type === 'step-begin') {
		ora.text = info.title;
	}
});

ee.on('finish', async () => {
	
});

ee.on('error', error => {
	ora.fail(error);
	process.exit(1);
});
