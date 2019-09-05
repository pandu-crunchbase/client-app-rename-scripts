const execSync: (
  command: string,
  options?: any
) => string = require("child_process").execSync;
const existsSync: (path: string) => boolean = require("fs").existsSync;
const readFileSync: (path: string, options?: any) => string = require("fs")
  .readFileSync;
const writeFileSync: (path: string, data: any) => void = require("fs")
  .writeFileSync;
const renameSync: (oldPath: string, newPath: string) => void = require("fs")
  .renameSync;

function getOutput(command: string): string {
  return execSync(command, { encoding: "utf-8" });
}

function getContents(filePath: string): string {
  return readFileSync(filePath, { encoding: "utf-8" });
}

let DEBUG_JUST_ONE = false;
// DEBUG_JUST_ONE = true;

const DOT_TPL_HTML = ".tpl.html";
const DOT_COMPONENT_HTML = ".component.html";
const DOT_COMPONENT_TS = ".component.ts";

enum Color {
  RESET = "\x1b[0m",
  RED = "\x1b[31m",
  GREEN = "\x1b[32m",
  YELLOW = "\x1b[33m",
  BLUE = "\x1b[34m",
  MAGENTA = "\x1b[35m",
  CYAN = "\x1b[36m"
}

interface Status {
  color: Color;
  code: string;
}

const OK: Status = {
  color: Color.GREEN,
  code: "OK"
};
const NOOP: Status = {
  // foo.component.html already exists
  color: Color.CYAN,
  code: "NOOP"
};
const NO_TEMPLATE_URL_FOUND: Status = {
  color: Color.YELLOW,
  code: "NOURL"
};
const UNEXPECTED_TEMPLATE_URL: Status = {
  // foo.component.ts has a templateUrl other than foo.tpl.html or foo.component.html
  color: Color.YELLOW,
  code: "WRONG"
};
const NO_TEMPLATE: Status = {
  color: Color.YELLOW,
  code: "MISSING"
};

function main() {
  const allFiles = getOutput("git ls-files").split("\n");
  let componentTSFiles = allFiles.filter(x => x.endsWith(DOT_COMPONENT_TS));
  getPaths(componentTSFiles[0]);
  if (DEBUG_JUST_ONE) {
    componentTSFiles = componentTSFiles.slice(0, 1);
  }
  for (let each of componentTSFiles) {
    rename(each);
  }
}

function getPaths(tsPath: string) {
  const newHtmlPathFull = tsPath.replace(
    /\.component\.ts$/,
    DOT_COMPONENT_HTML
  );
  const oldHtmlPathFull = tsPath.replace(/\.component\.ts$/, DOT_TPL_HTML);

  const newHtmlPathRelative = "./" + newHtmlPathFull.replace(/.*\//, "");
  const oldHtmlPathRelative = "./" + oldHtmlPathFull.replace(/.*\//, "");

  const tsNameOnly = tsPath.replace(/.*\//, "");

  return {
    oldHtmlPathFull,
    oldHtmlPathRelative,
    newHtmlPathFull,
    newHtmlPathRelative,
    tsNameOnly
  };
}

function rename(tsPath: string) {
  const paths = getPaths(tsPath);

  // If foo.component.html already exists, do nothing.
  if (existsSync(paths.newHtmlPathFull)) {
    logStatus(NOOP, tsPath);
    return;
  }

  // Look for templateUrl
  const tsContents = getContents(tsPath);
  const templateUrlRegex = /templateUrl: "([^"]*)"/;
  const match = tsContents.match(templateUrlRegex);
  if (!match) {
    logStatus(NO_TEMPLATE_URL_FOUND, tsPath);
    return;
  }

  // Check templateUrl is what we expect it to be (i.e. foo.tpl.html)
  const templateUrlInFile = match[1];
  if (
    templateUrlInFile !== paths.oldHtmlPathRelative &&
    "./" + templateUrlInFile !== paths.oldHtmlPathRelative
  ) {
    logStatus(UNEXPECTED_TEMPLATE_URL, tsPath);
    return;
  }

  // Check foo.tpl.html exists
  if (!existsSync(paths.oldHtmlPathFull)) {
    logStatus(NO_TEMPLATE, tsPath);
    return;
  }

  const newTemplateUrl = `templateUrl: "${paths.newHtmlPathRelative}"`;
  writeFileSync(tsPath, tsContents.replace(templateUrlRegex, newTemplateUrl));
  renameSync(paths.oldHtmlPathFull, paths.newHtmlPathFull);
  logStatus(OK, tsPath);
}

function logStatus(status: Status, tsPath: string) {
  const paths = getPaths(tsPath);
  console.log(
    status.color,
    (status.code as any).padEnd(9),
    Color.RESET,
    paths.tsNameOnly
  );
}

main();
