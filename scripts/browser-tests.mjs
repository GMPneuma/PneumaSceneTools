import {execFileSync} from "node:child_process";
execFileSync(process.execPath,["scripts/patrol-browser-test.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/modular-thumbnails-browser-test.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/modular-browser-test.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/scene-folder-browser-test.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/scene-wizard-browser-test.mjs"],{stdio:"inherit"});
execFileSync(process.execPath,["scripts/traps-browser-test.mjs"],{stdio:"inherit"});
for (const file of ["type-manager-browser-test.mjs","vehicle-seats-browser-test.mjs","vehicle-rotation-browser-test.mjs","token-artwork-browser-test.mjs","startup-browser-test.mjs","browser-test.mjs","variants-browser-test.mjs","json-browser-test.mjs","map-pins-browser-test.mjs"]) {
  execFileSync(process.execPath,[`scripts/${file}`],{stdio:"inherit"});
}

execFileSync(process.execPath,["tests/mookmaker/bullet-dodging.test.mjs"],{stdio:"inherit",env:{...process.env,PNEUMA_PLAYWRIGHT_MODULE:process.env.PNEUMA_PLAYWRIGHT_MODULE ?? "playwright"}});
