const R = "\x1b[31m";
const G = "\x1b[32m";
const Y = "\x1b[33m";
const B = "\x1b[1m";
const D = "\x1b[0m";

function red(s) {
  return `${R}${s}${D}`;
}
function green(s) {
  return `${G}${s}${D}`;
}
function yellow(s) {
  return `${Y}${s}${D}`;
}
function bold(s) {
  return `${B}${s}${D}`;
}

module.exports = { red, green, yellow, bold, R, G, Y, B, D };
