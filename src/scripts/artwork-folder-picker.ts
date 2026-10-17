import {bounded} from "./io.js";

/** Keep native folder selection and navigation; artwork below is preview-only. */
export class ArtworkFolderPicker extends FilePicker {
  private previewRequest = 0;

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const root = html[0]!;
    root.querySelector('.pneuma-folder-artwork')?.remove();
    const preview = document.createElement('section');
    preview.className = 'pneuma-folder-artwork';
    preview.setAttribute('aria-label', 'Artwork in this folder');
    const heading = document.createElement('p');
    heading.textContent = 'Artwork preview — select the folder using the folder button.';
    const status = document.createElement('p');status.setAttribute('role', 'status');status.textContent = 'Loading artwork…';
    const grid = document.createElement('div');grid.className = 'pneuma-folder-artwork-grid';
    preview.append(heading, status, grid);
    (root.querySelector('.filepicker-body') ?? root).append(preview);
    const request = ++this.previewRequest;
    const options: FilePicker.BrowseOptions = {};
    if (this.activeSource === 's3') options.bucket = this.sources.s3?.bucket;
    void bounded(FilePicker.browse(this.activeSource, this.target, options), new AbortController().signal).then(result => {
      if (request !== this.previewRequest) return;
      const files = result.files.filter(path => /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(path));
      status.textContent = files.length ? `${files.length} images. Preview only.` : 'No images in this folder.';
      for (const path of files) {
        const figure = document.createElement('figure');
        const img = document.createElement('img');img.src = path;img.loading = 'lazy';img.draggable = false;
        const name = path.split('/').pop() ?? path;
        img.alt = name;
        const caption = document.createElement('figcaption');caption.textContent = name;figure.title = name;
        figure.append(img, caption);grid.append(figure);
      }
      this.setPosition({height: 'auto'});
    }).catch(error => {if (request === this.previewRequest) status.textContent = `Cannot preview artwork: ${String(error)}`;});
  }

  override async close(options?: Application.CloseOptions): Promise<void> {
    this.previewRequest++;
    await super.close(options);
  }
}
