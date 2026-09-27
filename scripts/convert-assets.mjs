import { readdir } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import sharp from 'sharp';

const directory = resolve('public/assets');
const assets = (await readdir(directory)).filter((file) => extname(file).toLowerCase() === '.png');

await Promise.all(assets.map(async (file) => {
  const input = resolve(directory, file);
  const output = resolve(directory, `${basename(file, '.png')}.webp`);
  await sharp(input).webp({ quality: 82, alphaQuality: 90 }).toFile(output);
}));

process.stdout.write(`${assets.length} assets convertis en WebP.\n`);
