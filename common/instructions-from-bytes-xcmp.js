function intrustionsFromBytesXCMP(messageData, apiAt) {
  // // We recover all instructions
  let instructions = apiAt.registry.createType("XcmVersionedXcm", messageData); //ts as any

  // choose appropriate xcm version
  let asVersion = "not found";
  for (const versionNum of ["0", "1", "2"]) {
    if (instructions["isV" + versionNum]) {
      asVersion = "asV" + versionNum;
    }
  }
  if (asVersion === "not found") {
    return " - xcmp version not found";
  } else {
    let instructionsHuman = [];
    instructions[asVersion].forEach((instruction) => {
      instructionsHuman.push(instruction.toHuman());
    });
    return instructionsHuman;
  }
}

module.exports = {
  intrustionsFromBytesXCMP,
};
