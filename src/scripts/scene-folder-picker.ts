/** Native FilePicker template, tabs, favorites and listeners, mounted inside the wizard. */
export class SceneFolderPicker extends FilePicker {
  private host?: HTMLElement;
  private retainedFile = "";
  private restoreSelection = false;
  constructor(private changed: (loading: boolean, error?: unknown) => void, private next: () => void) {
    // Keep native file selection inside the wizard.
    super({type:"imagevideo",displayMode:"thumbs",popOut:false,allowUpload:false});
  }
  mount(host: HTMLElement) { this.host = host; this.restoreSelection = true; this.render(true); }
  get selectedFile(): string { return this.host?.querySelector<HTMLInputElement>('input[name="file"]')?.value.trim() ?? ""; }
  detach() { if (this.host) this.retainedFile = this.selectedFile; this.host = undefined; }
  protected override _injectHTML(html: JQuery) {
    if (!this.host?.isConnected) return;
    this.host.replaceChildren(...html.toArray());
    this._element = html;
  }
  protected override _replaceHTML(_element: JQuery, html: JQuery) { this._injectHTML(html); }
  override async browse(target?: string, options?: FilePicker.BrowseOptions): Promise<FilePicker.BrowseResult> {
    this.changed(true);
    try { const result = await super.browse(target,options); this.changed(false); return result; }
    catch (error) { this.changed(false,error); throw error; }
  }
  override activateListeners(html: JQuery) {
    super.activateListeners(html);
    if (this.restoreSelection) {
      const file = html[0]!.querySelector<HTMLInputElement>('input[name="file"]');
      if (file && this.retainedFile) file.value = this.retainedFile;
      this.restoreSelection = false;
    }
    // The wizard footer owns advancement; all navigation remains native.
    for (const button of html[0]!.querySelectorAll<HTMLButtonElement>('button[type="submit"]')) button.hidden = true;
  }
  protected override _onSubmit(event: Event) { event.preventDefault(); event.stopPropagation(); this.next(); }
}
