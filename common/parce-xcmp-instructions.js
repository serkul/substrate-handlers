function parceXcmpInstrustions(instructions, transfer) {
  // Check if xcmp version is 1, then parce the asset part
  // and extract effects/instructions from the object and use
  // them as V2,V3 instructions for further parcing
  if (instructions[0] == "xcmp_asV1") {
    instructions.slice(1).forEach((instruction) => {
      Object.keys(instruction).forEach((key) => {
        switch (key) {
          case "ReserveAssetDeposited":
            instruction.ReserveAssetDeposited.assets.forEach(({ id, fun }) => {
              transfer.assetId.push(JSON.stringify(id.Concrete));
              transfer.amount.push(fun.Fungible.replace(/,/g, ""));
            });
            let effects = [...instruction.ReserveAssetDeposited.effects];
          // fall through is intentional
          default:
            parceV2V3Instruction(effects);
        }
      });
    });
  } else {
    parceV2V3Instruction(instructions.slice(1)); //first element is xcmp version
  }
}
function parceV2V3Instruction(instructions) {
  // Remove ClearOrigin, its a string and does't contain
  // any info of interest (still can be seen in the list xcmpInstructions)
  idxClearOrigin = instructions.indexOf("ClearOrigin");
  if (idxClearOrigin > -1) instructions.splice(idxClearOrigin, 1);
  instructions.forEach((instruction) => {
    Object.keys(instruction).forEach((key) => {
      switch (key) {
        case "WithdrawAsset":
          instruction.WithdrawAsset.forEach(({ id, fun }) => {
            transfer.assetId.push(JSON.stringify(id.Concrete));
            transfer.amount.push(
              fun.Fungible?.replace(/,/g, "") ?? JSON.stringify(amount)
            );
          });
          break;
        case "BuyExecution":
          transfer.fees = JSON.stringify(instruction.BuyExecution);
          break;
        case "DepositAsset":
          transfer.toAddress =
            instruction.DepositAsset.beneficiary.interior.X1.AccountId32?.id ??
            instruction.DepositAsset.beneficiary.interior.X1.AccountKey20.key;
          break;
        default:
          transfer.warnings += ` - Unknown instruction name ${key}`;
      }
    });
  });
}

module.exports = {
  parceXcmpInstrustions,
};
