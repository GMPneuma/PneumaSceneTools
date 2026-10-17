import {gm} from "./documents.js";
/** A native form window for effect and trigger drafts. Closing never applies a draft. */
export class HazardPopup<T> extends FormApplication {
  private busy = false;
  private result: T | null = null;
  constructor(title: string, private readonly body: () => object, private readonly read: (form: HTMLFormElement) => T, private readonly change: ((form: HTMLFormElement, action: string) => Promise<void>) | undefined, private readonly finish: (result: T | null) => void) {
    super({}, {title});
  }
  static override get defaultOptions(): FormApplication.Options {
    return {
      ...super.defaultOptions, template: "modules/pneuma-scenetools/templates/hazard-popup.hbs",
      width: 480, height: "auto", resizable: true, closeOnSubmit: false, submitOnChange: false
    };
  }
  override getData() {return this.body();}
  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    html.find("[data-action]").on("click", event => {
      event.preventDefault();
      void this.run((event.currentTarget as HTMLElement).dataset.action!);
    });
    html.find("[name=kind]").on("change", () => void this.run("kind"));
  }
  protected override async _updateObject(): Promise<void> {await this.run("popupSave");}
  private async run(action: string): Promise<void> {
    if (this.busy || !(this.form instanceof HTMLFormElement))
      return;
    this.busy = true;
    try {
      gm();
      if (action === "popupCancel") {
        await this.close();
        return;
      }
      if (action === "popupSave") {
        this.result = this.read(this.form);
        await this.close();
        return;
      }
      await this.change?.(this.form, action);
      if (this.rendered)
        this.render(false);
    }
    catch (error) {
      const alert = this.form?.querySelector("[role=alert]");
      if (alert)
        alert.textContent = error instanceof Error ? error.message : String(error);
    }
    finally {
      this.busy = false;
    }
  }
  override async close(options?: Application.CloseOptions): Promise<void> {
    await super.close(options);
    this.finish(this.result);
  }
}
