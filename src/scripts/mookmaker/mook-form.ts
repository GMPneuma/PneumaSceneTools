import {MODULE_ID} from "./constants.js";
import {applyMookChanges} from "./apply-mook.js";
import {confirmPurgeGear} from "./purge.js";
import {confirmPromotion} from "./promotion.js";
import {getAvailableSystemRoles, type AvailableRole} from "./roles.js";
import {mookFormData} from "./form-data.js";
import {readMookForm} from "./form-input.js";
export async function showMookMakerMenu(token: Token): Promise<void> {
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
      content: await renderTemplate(`modules/${MODULE_ID}/templates/mook-maker.hbs`, mookFormData(token, availableRoles)),
      buttons: {},
      render: (html) => {
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
        try { changes = readMookForm(html, token, availableRoles, initialName); }
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
    { width: 650 },
  );
  dialog.render(true);
}

