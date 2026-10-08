import {execFileSync} from "node:child_process";
for (const file of ["startup-browser-test.mjs","browser-test.mjs","variants-browser-test.mjs"]) {
  execFileSync(process.execPath,[`scripts/${file}`],{stdio:"inherit"});
}
