import type {ArtworkCategory} from "../token-artwork.js";
import {listCategoryArtwork, artworkPreview} from "../artwork-media.js";
import {MODULE_ID} from "./constants.js";
import {applyMookChanges} from "./apply-mook.js";
import {confirmPurgeGear, hasSavedMook} from "./purge.js";
import {confirmPromotion} from "./promotion.js";
import {defaultNameRecipe,generateName,manualName} from './names.js';
import {getAvailableSystemRoles, type AvailableRole} from "./roles.js";
import {mookFormData} from "./form-data.js";
import {readMookForm} from "./form-input.js";
export async function showMookMakerMenu(token: Token): Promise<void> {
  const categories = ((game.settings!.get(MODULE_ID, "tokenArtworkCategories") ?? []) as ArtworkCategory[]).filter(row => row.kind === "mook")
    .sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:"base"}));
  const actorName = token.actor?.name ?? token.document.name;
  const initialName = token.document.name ?? token.actor?.name ?? "";
  let availableRoles: AvailableRole[];
  try {
    availableRoles = await getAvailableSystemRoles();
  } catch (error) {
    console.error("pneuma-scenetools | MookMaker | Failed to discover Cyberpunk RED roles", error);
    ui.notifications?.error("MookMaker could not load roles from the Cyberpunk RED system.");
    return;
  }

  const dialog = new Dialog(
    {
      title: game.i18n!.format("PNEUMA_MOOK_MAKER.Menu.Title", { name: actorName }),
      content: await renderTemplate(`modules/${MODULE_ID}/templates/mook-maker.hbs`, {...mookFormData(token, availableRoles), artworkCategories: categories.map((row, index) => ({name: row.name, index}))}),
      buttons: {},
      render: (html) => {
      const root = html[0]!;
      let naming=false;
      for(const action of ['generate-name','manual-name'])root.querySelector(`[data-action="${action}"]`)!.addEventListener('click',async()=>{
        if(naming)return;
        naming=true;
        const buttons=root.querySelectorAll<HTMLButtonElement>('[data-action="generate-name"],[data-action="manual-name"]');
        buttons.forEach(button=>button.disabled=true);
        try {
          const selected=root.querySelector<HTMLSelectElement>('[name="artworkCategory"]')!.value;
          const current=token.document.texture.src??'';
          const category=selected!==''&&selected!=='manual'?categories[Number(selected)]:selected===''?[...categories].sort((a,b)=>b.folder.length-a.folder.length).find(row=>current.startsWith(`${row.folder}/`)):undefined;
          const recipe=category?.nameRecipe??defaultNameRecipe();
          const input=root.querySelector<HTMLInputElement>('[name="name"]')!;
          const value=action==='generate-name'?await generateName(recipe):await manualName(recipe,input.value);
          if(value!==null&&root.isConnected){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
        }catch(error){ui.notifications?.error(String(error));}
        finally {naming=false;buttons.forEach(button=>button.disabled=false);}
      });
      const preview = root.querySelector<HTMLElement>('[data-artwork-preview]')!;
      const status = root.querySelector<HTMLElement>('[data-artwork-status]')!;
      let artwork: string | undefined, previewRequest = 0;
      let images: string[] = [];
      const choose = root.querySelector<HTMLButtonElement>('[data-action="choose-artwork"]')!;
      const showArtwork = (path: string | undefined) => {
        preview.replaceChildren();if (!path) return;
        const media = artworkPreview(path, 'Mook artwork');
        preview.append(media);
      };
      showArtwork(token.document.texture.src ?? undefined);
      root.querySelectorAll<HTMLSelectElement>('[name="artworkCategory"]').forEach(input => input.addEventListener('change', () => {
        const request = ++previewRequest;artwork = undefined;images = [];choose.disabled = true;
        if (input.value === '') {showArtwork(token.document.texture.src ?? undefined);status.textContent = '';return;}
        if (input.value === 'manual') {showArtwork(token.document.texture.src ?? undefined);status.textContent = '';choose.disabled = false;return;}
        const category = categories[Number(input.value)];if (!category) return;
        preview.replaceChildren();status.textContent = 'Loading artwork…';
        void listCategoryArtwork(category.folder).then(files => {
          if (request !== previewRequest) return;
          images = files;
          if (!images.length) throw new Error('No artwork in this category.');
          artwork = images[Math.floor(Math.random() * images.length)]!;showArtwork(artwork);status.textContent = '';choose.disabled = false;
        }).catch(error => {if (request === previewRequest) status.textContent = String(error);});
      }));
      choose.addEventListener('click', () => {
        const request = previewRequest;
        if (root.querySelector<HTMLSelectElement>('[name="artworkCategory"]')!.value === 'manual') {
          new FilePicker({type: 'imagevideo', current: artwork ?? token.document.texture.src ?? '', displayMode: 'thumbs', callback: path => {
            if (request !== previewRequest) return;
            artwork = path;showArtwork(path);status.textContent = '';
          }}).render(true);
          return;
        }
        if (!images.length) return;
        const picker = new Dialog({title: 'Choose category image', content: '<div class="pneuma-mook-image-choices"></div>', buttons: {}, render: html => {
          const grid = (html as JQuery)[0]!.querySelector('.pneuma-mook-image-choices')!;
          for (const path of images) {
            const button = document.createElement('button');button.type = 'button';
            const media = artworkPreview(path, path.split('/').pop() ?? path, true);
            const name = document.createElement('span');name.textContent = path.split('/').pop() ?? path;button.title = name.textContent;
            button.append(media,name);grid.append(button);
            button.addEventListener('click', () => {
              if (request === previewRequest) {artwork = path;showArtwork(path);status.textContent = '';}
              void picker.close();
            });
          }
        }}, {width: 540});picker.render(true);
      });
      for (const row of [1, 2]) {
        const initialWeaponId = String(
          html.find<HTMLInputElement>(`input[name="initialWeapon${row}"]`).val() ?? "",
        );
        html.find<HTMLSelectElement>(`select[name="weapon${row}"]`)
          .val(initialWeaponId);
      }
      const customNumber = html.find<HTMLInputElement>(
        ".pneuma-mook-maker-custom-number",
      );
      html.find<HTMLInputElement>('input[name="combatNumber"]').on("change", (event) => {
        const isCustom = (event.currentTarget as HTMLInputElement).value === "custom";
        customNumber.prop("disabled", !isCustom);
        if (isCustom) customNumber.trigger("focus");
      });
      customNumber.on("input", (event) => {
        const input = event.currentTarget as HTMLInputElement;
        input.value = input.value.replace(/\D/g, "").slice(0, 2);
        if (Number(input.value) > 20) input.value = "20";
      });
      html.find<HTMLInputElement>('#pneuma-mook-maker-level').on("input", (event) => {
        const input = event.currentTarget as HTMLInputElement;
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
      });
      html
        .find<HTMLInputElement>('input[name="secondarySkillsTarget"], input[name="tertiarySkillsTarget"]')
        .on("focus", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const adjustmentName = input.name.replace(/Target$/, "");
          html
            .find<HTMLInputElement>(`input[name="${adjustmentName}"][value="set-custom"]`)
            .prop("checked", true)
            .trigger("change");
        })
        .on("input", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          input.value = input.value.replace(/\D/g, "").slice(0, 2);
          if (Number(input.value) > 18) input.value = "18";
          const adjustmentName = input.name.replace(/Target$/, "");
          html
            .find<HTMLInputElement>(`input[name="${adjustmentName}"][value="set-custom"]`)
            .prop("checked", true);
        });

      html.find('[data-action="apply"]').on("click", async () => {
        const applyButton = html.find<HTMLButtonElement>('[data-action="apply"]');
        if (applyButton.prop("disabled")) return;
        let changes;
        try {
          changes = readMookForm(html, token, availableRoles, initialName);
          const selected = root.querySelector<HTMLSelectElement>('[name="artworkCategory"]');
          if (selected?.value) {
            if (!artwork) throw new Error(selected.value === 'manual' ? 'Choose an image, or choose Keep Current.' : 'Wait for category artwork to load, or choose Keep Current.');
            changes.artwork = artwork;
          }
        }
        catch (error) { ui.notifications?.warn(error instanceof Error ? error.message : String(error)); return; }
        html.find("button").prop("disabled", true);
        try {
          const nameChanged = await applyMookChanges(changes);
          if (nameChanged) {
            ui.notifications?.info(
              game.i18n!.format("PNEUMA_MOOK_MAKER.Form.Renamed", {
                name: changes.newName,
              }),
            );
          }
        } catch (error) {
          ui.notifications?.error(
            error instanceof Error ? error.message : game.i18n!.localize("PNEUMA_MOOK_MAKER.Form.ApplyFailed"),
          );
          html.find("button").prop("disabled", false);
          html.find('[data-action="purge-gear"]').prop("disabled", !hasSavedMook(token));
          return;
        }

        dialog.close();
      });
      html.find('[data-action="cancel"]').on("click", () => dialog.close());
      html.find('[data-action="purge-gear"]').on("click", async () => {
        try { if (await confirmPurgeGear(token)) {
          dialog.close();
          await showMookMakerMenu(token);
        } } catch (error) { ui.notifications?.error(String(error)); }
      });
      html.find('[data-action="promote"]').on("click", () => {
        confirmPromotion(token, dialog);
      });
      },
    },
    { width: 780, height: "auto", classes: ["dialog", "pneuma-mook-maker-dialog"] },
  );
  dialog.render(true);
}

