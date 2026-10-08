import {execFileSync} from "node:child_process";
for (const file of ["startup-browser-test.mjs","browser-test.mjs","variants-browser-test.mjs","json-browser-test.mjs"]) {
  execFileSync(process.execPath,[`scripts/${file}`],{stdio:"inherit"});
}

execFileSync(process.execPath,["tests/mookmaker/bullet-dodging.test.mjs"],{stdio:"inherit",env:{...process.env,PNEUMA_PLAYWRIGHT_MODULE:process.env.PNEUMA_PLAYWRIGHT_MODULE ?? "playwright"}});
