import {bounded} from "./io.js";

const mediaPath = (path: string): string => path.split(/[?#]/, 1)[0]!;
export function isArtworkVideo(path: string): boolean {
  return VideoHelper.hasVideoExtension(mediaPath(path));
}
export async function listCategoryArtwork(folder: string): Promise<string[]> {
  const result = await bounded(FilePicker.browse("data", `${folder.replace(/\/+$/, "")}/*`, {wildcard: true}), new AbortController().signal);
  return result.files.filter(path => ImageHelper.hasImageExtension(mediaPath(path)) || isArtworkVideo(path));
}
export function artworkPreview(path: string, alt: string, lazy = false): HTMLImageElement | HTMLVideoElement {
  const media = document.createElement(isArtworkVideo(path) ? "video" : "img");
  media.src = path;
  if (media instanceof HTMLVideoElement) {
    media.muted = true;
    media.autoplay = true;
    media.loop = true;
  } else {
    media.alt = alt;
    media.draggable = false;
    if (lazy) media.loading = "lazy";
  }
  return media;
}
