import {
  NATURAL_SWAT_RIGS,
  validateNaturalSwatFrames,
} from "../app/components/asciiArmMotion.js";

validateNaturalSwatFrames();
console.log(
  `Validated ${Object.keys(NATURAL_SWAT_RIGS).length} raised, bent-elbow ASCII arm poses.`,
);
