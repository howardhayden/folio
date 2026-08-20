export const ASCII_COLUMNS = 70;
export const ASCII_ROWS = 34;

export const ASCII_CHARACTER_DESCRIPTION =
  "A person sitting beneath a tree writes on a tablet and occasionally notices and swats toward a moving mouse pointer.";

export const asciiPortrait = String.raw`MMMMMMMMMMMMMMMMMMMKl'.;:'...         .....';oxkkkkOKXNNNNNWWMMNkol:''
MMMMMMMMMMMMMMMMMMW0c. ...            ..,;:oO0Oxdllldk0KKXNNNWWNKOkxdo
MMMMMMMMMMMMMWWMMWk;.              ...':dOOOkdl;'...';::cox0XNNWWMMMMM
MMMMMXo;:ccc:,','.....         .';oxkKNNXKOxl;,;'....,......'lOXNWWWWW
WWWWMWk;,'.........           .';d000Okdl:;'..'.. ...........:kXXXKKKK
0kxONMXxc'..                  .;okxdl:'...........       ....,dKXK0Okk
kdodKWMWXOdc,.................;xKKOkkkkxo;.... ...,'..    ...'cOXKOkxd
OkkO00KXNNWNKOko;''''''''';codONWNNNNNWN0xc,'....'::,'.    ...;xKKOxdd
Okxxdddxxk0KXNNNOc,'',:ldOKNWWWNNNXXXNNW0occoo:'';:;'''.......,coodddd
OOOOOOOOO00KKKXNWN0OO0XWMWWNNNNXXXXXXNNNXOxddo:;:::,.';;;,'.',cdxk0K0k
XXXXXXXNNNNNNNNNNNWWWWWNNXXNNWWWWWWWWWWWMMWKd:,;;::;',::::;;;:ldxxOOkd
NNWWWWWWWWWWMMMMWWWNNNNNNNNWWWMMMMMMMMMMMMMXd:;;;;;,'';ccllc:,''..... 
MMMMMMMMMMMMMMMMMMMWWWWWWWMMMMMMMMMMMMMMMMMN0xo:;;'...';:c:,.         
MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMN0dc;....',;'.           
MMMMMMMMMMMMMMMMMWWMMMMMMMMWWWWWWWWWWMMMMMMMMMMNOc;cdo;..             
MMMMMMMWWWWWWWWWWWWWWWWWWWNNNNNNNNNNWWWWWMMMMMMMWNNW0:.               
MMMMMMWWWNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNWWWMMMMMMW0;.                
MMMMMMMMWWWNWWWNNNNNNNNNNXXXXXXXXXXXXNNNNNNWWWMMW0l.                  
MMMMMMMMMWWWWWWWNNXXXKKK0OOkkkkkkkkOOOO0KKKXXNWWk'                    
MMMWWWWWWWWNNNNNXXK00OOkkkkkkkkkkkOOOOO00KKXWWWO,.                    
NNXK00OOOkkkkkkkkkkxxxxkkOOOO00000000KXNNNNNWMK:.                     
OOOOOkxxdddddxxxxxxkO00KKXXXXNNNNNNNWWMMMMWWMWx.                      
OOkkOO0OkxxkkkOOOO0XNNNNNNNNNNNNWWWWWMMMMMMMMWx.                      
KKK0KKKKK000OkxdxOKXNWWWWWWWNNNWWWMMMMMMMMMMMKc.                      
NXKOOkxdlc;,,,,;;:oOXWMMMMMMWWWMMMMMMMMMMNKXNd.                       
N0l'.....   .......'ckXWMMMMMMMMWNXXNWN0xxkXNo.                       
WNKd;.               .'l0WMMMMW0l;:cc:;;oKWMMK:                       
WWMWXOo,.               .:kXMWOoc;,'',::lxKWXl.                       
NWMMWWWXx;.         .;:;:;'ckd;:ddolc:;,,:lxl.                        
KXWWWWWWWXkc.     .ck0KKKkdc'.,ldxkOxc'...',,.                        
kKWNKOxdodxdl;'..,ok0KX0kxdoc;'...'',;;,,'..                          
dk0xl;'......',;;coxO00Oxkkkxo;..     .,oc.                           
:clc;'..........',,,;coxk0XXXXOdc::;;'.''.                            
:clc'... ..............;dOXNWWWNNNXXKd,..`;

/** @typedef {{ row: number, column: number, text: string }} AsciiPatch */
/** @typedef {{ pose: string, durationMs: number }} TimedPose */
/** @typedef {'left' | 'right' | 'upper-left' | 'upper-right'} SwatDirection */
/** @typedef {'blank' | 'image' | 'near-person' | 'person' | 'tablet'} AsciiHit */

/** @type {Readonly<Record<string, readonly AsciiPatch[]>>} */
export const ASCII_POSES = Object.freeze({
  "write-rest": Object.freeze([]),
  "write-left": Object.freeze([
    Object.freeze({ row: 29, column: 38, text: "'..',,,." }),
    Object.freeze({ row: 30, column: 36, text: ",;;,.'.." }),
    Object.freeze({ row: 31, column: 38, text: ".'oc. " }),
  ]),
  "write-center": Object.freeze([
    Object.freeze({ row: 29, column: 38, text: "'...',,." }),
    Object.freeze({ row: 30, column: 36, text: ",;;,,'.." }),
    Object.freeze({ row: 31, column: 38, text: ".,oc. " }),
  ]),
  "write-right": Object.freeze([
    Object.freeze({ row: 29, column: 38, text: "',..',,." }),
    Object.freeze({ row: 30, column: 36, text: ",;,,'..." }),
    Object.freeze({ row: 31, column: 38, text: ",;oc. " }),
  ]),
  "write-pause": Object.freeze([
    Object.freeze({ row: 27, column: 34, text: ",',.,::" }),
    Object.freeze({ row: 29, column: 38, text: "'...',,." }),
    Object.freeze({ row: 31, column: 38, text: ".,oc. " }),
  ]),
  "write-shoulder": Object.freeze([
    Object.freeze({ row: 28, column: 30, text: ";:ddolc;" }),
    Object.freeze({ row: 29, column: 30, text: ";ldxkOxc" }),
    Object.freeze({ row: 30, column: 36, text: ",;;,,'.." }),
  ]),
  "notice-left": Object.freeze([
    Object.freeze({ row: 26, column: 33, text: ";:cc:;;o" }),
    Object.freeze({ row: 27, column: 33, text: ";,'<,::l" }),
    Object.freeze({ row: 28, column: 38, text: ";,,:lxl." }),
  ]),
  "notice-right": Object.freeze([
    Object.freeze({ row: 26, column: 33, text: ";:cc:;;o" }),
    Object.freeze({ row: 27, column: 33, text: ";,'>,::l" }),
    Object.freeze({ row: 28, column: 38, text: ";,,:lxl." }),
  ]),
  "right-windup": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'>,::lxKWXl." }),
    Object.freeze({ row: 28, column: 38, text: ";,,<lxl.  _" }),
    Object.freeze({ row: 29, column: 38, text: "'..',,.__/ " }),
  ]),
  "right-extend": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'>,::lxKWXl." }),
    Object.freeze({ row: 28, column: 38, text: ";,,:lxl.      /" }),
    Object.freeze({ row: 29, column: 38, text: "'..',,.__/----o" }),
  ]),
  "right-contact": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'>,::lxKWXl." }),
    Object.freeze({ row: 28, column: 38, text: ";,,:lxl.   __/-----O" }),
    Object.freeze({ row: 29, column: 38, text: "'..',,.__/" }),
  ]),
  "right-recoil": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'>,::lxKWXl." }),
    Object.freeze({ row: 28, column: 38, text: ";,,:lxl.  __/" }),
    Object.freeze({ row: 29, column: 38, text: "'...',,." }),
  ]),
  "upper-right-windup": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'>,::lxKWXl." }),
    Object.freeze({ row: 28, column: 38, text: ";,,<lxl. _/" }),
    Object.freeze({ row: 29, column: 38, text: "'..',,." }),
  ]),
  "upper-right-extend": Object.freeze([
    Object.freeze({ row: 25, column: 46, text: ":      o" }),
    Object.freeze({ row: 26, column: 46, text: ":     /" }),
    Object.freeze({ row: 27, column: 46, text: ".    /" }),
    Object.freeze({ row: 28, column: 45, text: ".  _/" }),
    Object.freeze({ row: 29, column: 38, text: "'..',,./" }),
  ]),
  "upper-right-contact": Object.freeze([
    Object.freeze({ row: 24, column: 47, text: "      O" }),
    Object.freeze({ row: 25, column: 46, text: ":    _/" }),
    Object.freeze({ row: 26, column: 46, text: ":   /" }),
    Object.freeze({ row: 27, column: 46, text: ".  /" }),
    Object.freeze({ row: 28, column: 45, text: "._/" }),
  ]),
  "upper-right-recoil": Object.freeze([
    Object.freeze({ row: 26, column: 46, text: ":   o" }),
    Object.freeze({ row: 27, column: 46, text: ".  /" }),
    Object.freeze({ row: 28, column: 45, text: "._/" }),
    Object.freeze({ row: 29, column: 38, text: "'...',,." }),
  ]),
  "left-windup": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 35, text: "lc:;,,lxl._" }),
    Object.freeze({ row: 29, column: 32, text: "dxkOxc'..\\,,." }),
  ]),
  "left-extend": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 20, text: ".;o<----------\\;,,,:lxl." }),
    Object.freeze({ row: 29, column: 32, text: "dxkOxc'...',,." }),
  ]),
  "left-contact": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 17, text: "O<-------------\\;,,,:lxl." }),
    Object.freeze({ row: 29, column: 32, text: "dxkOxc'...',,." }),
  ]),
  "left-recoil": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 24, text: ":;o<----\\c:;,,:lxl." }),
    Object.freeze({ row: 29, column: 32, text: "dxkOxc'...',,." }),
  ]),
  "upper-left-windup": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 35, text: "lc:;,<lxl.\\" }),
    Object.freeze({ row: 29, column: 32, text: "dxkOxc'...',,." }),
  ]),
  "upper-left-extend": Object.freeze([
    Object.freeze({ row: 24, column: 24, text: "o\\MMMMMMWWW" }),
    Object.freeze({ row: 25, column: 28, text: "\\MMMMWNXX" }),
    Object.freeze({ row: 26, column: 32, text: "\\;:cc:;;o" }),
    Object.freeze({ row: 27, column: 36, text: "\\,::lxKW" }),
    Object.freeze({ row: 28, column: 40, text: "\\:lxl." }),
  ]),
  "upper-left-contact": Object.freeze([
    Object.freeze({ row: 23, column: 20, text: "O\\0OkxdxOK" }),
    Object.freeze({ row: 24, column: 24, text: " \\MMMMMMWWW" }),
    Object.freeze({ row: 25, column: 28, text: " \\MMWNXX" }),
    Object.freeze({ row: 26, column: 32, text: " \\:cc:;;" }),
    Object.freeze({ row: 27, column: 36, text: " \\,::lx" }),
  ]),
  "upper-left-recoil": Object.freeze([
    Object.freeze({ row: 25, column: 28, text: "o\\MMWNXX" }),
    Object.freeze({ row: 26, column: 32, text: " \\:cc:;;" }),
    Object.freeze({ row: 27, column: 36, text: " \\,::lx" }),
    Object.freeze({ row: 28, column: 40, text: " \\lxl." }),
  ]),
  "recover-left": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 38, text: ";,,:lxl._" }),
    Object.freeze({ row: 29, column: 38, text: "'...',,." }),
  ]),
  "recover-right": Object.freeze([
    Object.freeze({ row: 27, column: 33, text: ";,'>,::lxKWXl." }),
    Object.freeze({ row: 28, column: 38, text: ";,,:lxl._" }),
    Object.freeze({ row: 29, column: 38, text: "'...',,." }),
  ]),
});

export const ASCII_SEQUENCES = Object.freeze({
  writing: Object.freeze([
    Object.freeze({ pose: "write-rest", durationMs: 1150 }),
    Object.freeze({ pose: "write-left", durationMs: 170 }),
    Object.freeze({ pose: "write-center", durationMs: 170 }),
    Object.freeze({ pose: "write-right", durationMs: 170 }),
    Object.freeze({ pose: "write-center", durationMs: 180 }),
    Object.freeze({ pose: "write-rest", durationMs: 950 }),
    Object.freeze({ pose: "write-pause", durationMs: 360 }),
    Object.freeze({ pose: "write-rest", durationMs: 1250 }),
    Object.freeze({ pose: "write-shoulder", durationMs: 250 }),
    Object.freeze({ pose: "write-rest", durationMs: 1450 }),
  ]),
  notice: Object.freeze({
    left: Object.freeze([
      Object.freeze({ pose: "write-pause", durationMs: 90 }),
      Object.freeze({ pose: "notice-left", durationMs: 230 }),
    ]),
    right: Object.freeze([
      Object.freeze({ pose: "write-pause", durationMs: 90 }),
      Object.freeze({ pose: "notice-right", durationMs: 230 }),
    ]),
  }),
  swat: Object.freeze({
    left: Object.freeze([
      Object.freeze({ pose: "left-windup", durationMs: 95 }),
      Object.freeze({ pose: "left-extend", durationMs: 105 }),
      Object.freeze({ pose: "left-contact", durationMs: 115 }),
      Object.freeze({ pose: "left-recoil", durationMs: 145 }),
    ]),
    right: Object.freeze([
      Object.freeze({ pose: "right-windup", durationMs: 95 }),
      Object.freeze({ pose: "right-extend", durationMs: 105 }),
      Object.freeze({ pose: "right-contact", durationMs: 115 }),
      Object.freeze({ pose: "right-recoil", durationMs: 145 }),
    ]),
    "upper-left": Object.freeze([
      Object.freeze({ pose: "upper-left-windup", durationMs: 95 }),
      Object.freeze({ pose: "upper-left-extend", durationMs: 105 }),
      Object.freeze({ pose: "upper-left-contact", durationMs: 115 }),
      Object.freeze({ pose: "upper-left-recoil", durationMs: 145 }),
    ]),
    "upper-right": Object.freeze([
      Object.freeze({ pose: "upper-right-windup", durationMs: 95 }),
      Object.freeze({ pose: "upper-right-extend", durationMs: 105 }),
      Object.freeze({ pose: "upper-right-contact", durationMs: 115 }),
      Object.freeze({ pose: "upper-right-recoil", durationMs: 145 }),
    ]),
  }),
  recover: Object.freeze({
    left: Object.freeze([
      Object.freeze({ pose: "recover-left", durationMs: 170 }),
      Object.freeze({ pose: "write-pause", durationMs: 220 }),
    ]),
    right: Object.freeze([
      Object.freeze({ pose: "recover-right", durationMs: 170 }),
      Object.freeze({ pose: "write-pause", durationMs: 220 }),
    ]),
  }),
});

export const ASCII_SHOULDER = Object.freeze({ row: 28, column: 41 });

export const ASCII_REGIONS = Object.freeze({
  tablet: Object.freeze({ top: 28, right: 46, bottom: 32, left: 29 }),
  person: Object.freeze({ top: 23, right: 49, bottom: 33, left: 17 }),
  nearPerson: Object.freeze({ top: 19, right: 57, bottom: 33, left: 11 }),
});

/**
 * @param {string} art
 * @returns {string[]}
 */
export function normalizeAsciiArt(art) {
  if (typeof art !== "string") {
    throw new TypeError("ASCII art must be a string.");
  }

  const normalized = art.replace(/\r\n?/g, "\n");
  if (normalized.includes("\t")) {
    throw new Error("ASCII art must not contain tab characters.");
  }

  const lines = normalized.split("\n");
  if (lines.length !== ASCII_ROWS) {
    throw new Error(
      `ASCII art must contain exactly ${ASCII_ROWS} rows; received ${lines.length}.`,
    );
  }

  return lines.map((line, row) => {
    if (line.length > ASCII_COLUMNS) {
      throw new Error(
        `ASCII row ${row} exceeds ${ASCII_COLUMNS} columns (${line.length}).`,
      );
    }
    return line.padEnd(ASCII_COLUMNS, " ");
  });
}

/**
 * @param {string} art
 * @param {string} poseName
 * @returns {string}
 */
export function applyAsciiPose(art, poseName) {
  const patches = ASCII_POSES[poseName];
  if (!patches) {
    throw new Error(`Unknown ASCII pose: ${poseName}`);
  }

  const grid = normalizeAsciiArt(art).map((line) => Array.from(line));
  for (const patch of patches) {
    const { row, column, text } = patch;
    if (text.includes("\n") || text.includes("\r") || text.includes("\t")) {
      throw new Error(`ASCII pose ${poseName} contains a multiline or tabbed patch.`);
    }
    if (
      row < 0 ||
      row >= ASCII_ROWS ||
      column < 0 ||
      column + text.length > ASCII_COLUMNS
    ) {
      throw new Error(
        `ASCII pose ${poseName} patch exceeds the ${ASCII_COLUMNS}x${ASCII_ROWS} grid.`,
      );
    }
    for (let offset = 0; offset < text.length; offset += 1) {
      grid[row][column + offset] = text[offset];
    }
  }

  return grid.map((line) => line.join("")).join("\n");
}

/**
 * @param {string} art
 * @returns {Record<string, string>}
 */
export function createAsciiFrames(art) {
  return Object.fromEntries(
    Object.keys(ASCII_POSES).map((poseName) => [
      poseName,
      applyAsciiPose(art, poseName),
    ]),
  );
}

/**
 * @param {string[]} lines
 * @param {number} row
 * @param {number} column
 * @param {number} radius
 * @returns {boolean}
 */
function hasInkNearby(lines, row, column, radius) {
  for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
    for (
      let columnOffset = -radius;
      columnOffset <= radius;
      columnOffset += 1
    ) {
      const sampleRow = row + rowOffset;
      const sampleColumn = column + columnOffset;
      if (
        sampleRow >= 0 &&
        sampleRow < ASCII_ROWS &&
        sampleColumn >= 0 &&
        sampleColumn < ASCII_COLUMNS &&
        lines[sampleRow][sampleColumn] !== " "
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {{ top: number, right: number, bottom: number, left: number }} region
 * @param {number} row
 * @param {number} column
 * @returns {boolean}
 */
function isWithinRegion(region, row, column) {
  return (
    row >= region.top &&
    row <= region.bottom &&
    column >= region.left &&
    column <= region.right
  );
}

/**
 * @param {string[]} lines
 * @param {number} row
 * @param {number} column
 * @returns {AsciiHit}
 */
export function classifyAsciiPoint(lines, row, column) {
  if (
    row < 0 ||
    row >= ASCII_ROWS ||
    column < 0 ||
    column >= ASCII_COLUMNS
  ) {
    return "blank";
  }

  if (
    isWithinRegion(ASCII_REGIONS.tablet, row, column) &&
    hasInkNearby(lines, row, column, 1)
  ) {
    return "tablet";
  }

  if (
    isWithinRegion(ASCII_REGIONS.person, row, column) &&
    hasInkNearby(lines, row, column, 1)
  ) {
    return "person";
  }

  if (lines[row][column] !== " " || hasInkNearby(lines, row, column, 1)) {
    return "image";
  }

  if (
    isWithinRegion(ASCII_REGIONS.nearPerson, row, column) &&
    hasInkNearby(lines, row, column, 2)
  ) {
    return "near-person";
  }

  return "blank";
}

/**
 * @param {number} row
 * @param {number} column
 * @returns {SwatDirection}
 */
export function directionForAsciiPoint(row, column) {
  const side = column < ASCII_SHOULDER.column ? "left" : "right";
  const isUpper = row <= ASCII_SHOULDER.row - 2;
  return isUpper ? `upper-${side}` : side;
}

/**
 * @param {SwatDirection} direction
 * @returns {'left' | 'right'}
 */
export function sideForSwatDirection(direction) {
  return direction.endsWith("left") ? "left" : "right";
}

/**
 * Throws during builds and tests if any pose, patch, region, or sequence can
 * change the portrait's fixed 70x34 geometry.
 *
 * @param {string} [art]
 * @returns {true}
 */
export function validateAsciiCharacterDefinition(art = asciiPortrait) {
  const baseLines = normalizeAsciiArt(art);

  for (const [poseName, patches] of Object.entries(ASCII_POSES)) {
    for (const patch of patches) {
      if (!Number.isInteger(patch.row) || !Number.isInteger(patch.column)) {
        throw new Error(`ASCII pose ${poseName} uses a non-integer patch origin.`);
      }
      if (patch.text.includes("\t")) {
        throw new Error(`ASCII pose ${poseName} contains a tab.`);
      }
    }

    const frameLines = applyAsciiPose(art, poseName).split("\n");
    if (
      frameLines.length !== ASCII_ROWS ||
      frameLines.some((line) => line.length !== ASCII_COLUMNS)
    ) {
      throw new Error(`ASCII pose ${poseName} changes the fixed frame geometry.`);
    }
  }

  /** @param {readonly TimedPose[]} sequence @param {string} label */
  const validateSequence = (sequence, label) => {
    if (!Array.isArray(sequence) || sequence.length === 0) {
      throw new Error(`ASCII sequence ${label} must contain at least one pose.`);
    }
    for (const frame of sequence) {
      if (!ASCII_POSES[frame.pose]) {
        throw new Error(`ASCII sequence ${label} references ${frame.pose}.`);
      }
      if (!Number.isFinite(frame.durationMs) || frame.durationMs <= 0) {
        throw new Error(`ASCII sequence ${label} has an invalid duration.`);
      }
    }
  };

  validateSequence(ASCII_SEQUENCES.writing, "writing");
  for (const [side, sequence] of Object.entries(ASCII_SEQUENCES.notice)) {
    validateSequence(sequence, `notice.${side}`);
  }
  for (const [direction, sequence] of Object.entries(ASCII_SEQUENCES.swat)) {
    validateSequence(sequence, `swat.${direction}`);
  }
  for (const [side, sequence] of Object.entries(ASCII_SEQUENCES.recover)) {
    validateSequence(sequence, `recover.${side}`);
  }

  for (const [regionName, region] of Object.entries(ASCII_REGIONS)) {
    if (
      region.top < 0 ||
      region.left < 0 ||
      region.bottom >= ASCII_ROWS ||
      region.right >= ASCII_COLUMNS ||
      region.top > region.bottom ||
      region.left > region.right
    ) {
      throw new Error(`ASCII region ${regionName} exceeds the portrait grid.`);
    }
  }

  if (baseLines.some((line) => line.length !== ASCII_COLUMNS)) {
    throw new Error("ASCII base portrait is not normalized to fixed-width rows.");
  }

  return true;
}

validateAsciiCharacterDefinition();
