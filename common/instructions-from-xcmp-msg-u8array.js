function intrustionsFromXcmU8Array(messageData, apiAt) {
  // Create type for instructions
  let instructions = apiAt.registry.createType("XcmVersionedXcm", messageData); //ts as any

  // choose appropriate xcmp version
  let asVersion = "not found";
  for (const versionNum of ["0", "1", "2"]) {
    if (instructions["isV" + versionNum]) {
      asVersion = "asV" + versionNum;
    }
  }
  // Return string message if the version is not found
  if (asVersion === "not found") {
    return " - xcmp version not found";
  } else {
    // Push readable instruction in an array
    let instructionsHuman = [];
    // V1 sends all instructions in one object
    if (asVersion == "asV1") {
      // Add version name, needed for parceXcmpInstructions function
      instructionsHuman.push("xcmpVersion1");
      instructionsHuman.push(instructions.asV1.toHuman());
    } else {
      instructions[asVersion].forEach((instruction) => {
        instructionsHuman.push(instruction.toHuman());
      });
    }
    // Return the array containing instructions
    return instructionsHuman;
  }
}

module.exports = {
  intrustionsFromXcmU8Array,
};
