/** Keep Scene Tools actions together below Foundry's native Create Scene/Create Folder row. */
export function sceneToolsRow(root:HTMLElement):HTMLElement|undefined {
  const header=root.querySelector<HTMLElement>(".directory-header");
  if(!header)return;
  const existing=header.querySelector<HTMLElement>(".pneuma-scene-tools-row");
  if(existing)return existing;
  const native=header.querySelector(".header-actions, .action-buttons");
  const row=document.createElement("div");row.className=`${native?.className??"action-buttons flexrow"} pneuma-scene-tools-row`;
  row.setAttribute("role","group");row.setAttribute("aria-label","Scene Tools");
  if(native)native.after(row);else header.prepend(row);
  return row;
}
