import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stateDir } from './argon-state';

export interface EditorMedia { url: string; name: string; mime: string; size: number; created: string }
const mimeTypes: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'video/mp4': 'mp4', 'application/pdf': 'pdf' };
export const mediaLimit = 20 * 1024 * 1024;
const mediaDir = () => resolve(stateDir(), 'media');
export const validMediaFile = (name: string) => /^[a-f\d-]{36}\.(?:jpg|png|gif|webp|avif|mp3|ogg|mp4|pdf)$/.test(name);

export async function saveEditorMedia(file: File): Promise<EditorMedia> {
  const extension = mimeTypes[file.type];
  if (!extension || !file.size || file.size > mediaLimit) throw new Error('请选择 20 MB 以内的 JPG、PNG、GIF、WebP、AVIF、MP3、OGG、MP4 或 PDF 文件。');
  const name = randomUUID() + '.' + extension;
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = extension === 'jpg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : extension === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : extension === 'gif' ? /^GIF8[79]a$/.test(bytes.toString('ascii',0,6))
    : extension === 'webp' ? bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
    : extension === 'avif' ? bytes.toString('ascii',4,8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii',8,32))
    : extension === 'mp4' ? bytes.toString('ascii',4,8) === 'ftyp'
    : extension === 'pdf' ? bytes.toString('ascii',0,5) === '%PDF-'
    : extension === 'ogg' ? bytes.toString('ascii',0,4) === 'OggS'
    : bytes.toString('ascii',0,3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (!valid) throw new Error('文件内容与文件类型不匹配。');
  const media = { url: '/media/' + name, name: file.name.slice(0,200), mime: file.type, size: file.size, created: new Date().toISOString() };
  const dir = mediaDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(resolve(dir, name), bytes, { flag: 'wx', mode: 0o600 });
  try { await writeFile(resolve(dir, name + '.json'), JSON.stringify(media), { flag: 'wx', mode: 0o600 }); }
  catch (error) { await unlink(resolve(dir, name)); throw error; }
  return media;
}

export async function listEditorMedia() {
  const files = await readdir(mediaDir()).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error; });
  return Promise.all(files.filter((file) => file.endsWith('.json') && validMediaFile(file.slice(0,-5))).map(async (file) => JSON.parse(await readFile(resolve(mediaDir(), file), 'utf8')) as EditorMedia));
}

export async function readEditorMedia(file: string) {
  return { bytes: await readFile(resolve(mediaDir(), file)), info: JSON.parse(await readFile(resolve(mediaDir(), file + '.json'), 'utf8')) as EditorMedia };
}
