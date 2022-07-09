function parceXcmpInstrustions(instructions, transfer) {
  // Check if xcmp version is 1, then parce the asset part
  // and extract effects/instructions from the object and use
  // them as V2,V3 instructions for further parcing
  if (instructions[0] == "xcmpVersion1") {
    console.log("parcing V1 xcmp instructions");
    instructions.slice(1).forEach((instruction) => {
      Object.keys(instruction).forEach((key) => {
        // fall through is intentional
        switch (key) {
          case "ReserveAssetDeposited":
            instruction.ReserveAssetDeposited.assets.forEach(({ id, fun }) => {
              transfer.assetId.push(JSON.stringify(id.Concrete));
              transfer.amount.push(fun.Fungible.replace(/,/g, ""));
            });
            let effects = [...instruction.ReserveAssetDeposited.effects];
          default:
            effects.forEach((instruction) => {
              Object.keys(instruction).forEach((key) => {
                switch (key) {
                  case "WithdrawAsset":
                    transfer.amount = instruction.WithdrawAsset[0].fun.Fungible;
                    transfer.assetId = JSON.stringify(
                      instruction.WithdrawAsset[0].id
                    );
                    break;
                  case "BuyExecution":
                    transfer.fees = JSON.stringify(instruction.BuyExecution);
                    break;
                  case "DepositAsset":
                    transfer.toAddress =
                      instruction.DepositAsset.beneficiary.interior.X1
                        .AccountId32?.id ??
                      instruction.DepositAsset.beneficiary.interior.X1
                        .AccountKey20.key;
                    break;
                  default:
                    transfer.warnings += ` - Unknown xcmpVersion1 instruction name ${key}`;
                }
              });
            });
        }
      });
    });
  } else {
    instructions.forEach((instruction) => {
      Object.keys(instruction).forEach((key) => {
        console.log(instruction);
        switch (key) {
          case "WithdrawAsset":
            transfer.amount =
              instruction.WithdrawAsset[0].fun.Fungible.toString();
            transfer.assetId = JSON.stringify(instruction.WithdrawAsset[0].id);
            break;
          case "BuyExecution":
            transfer.fees = JSON.stringify(instruction.BuyExecution);
            break;
          case "DepositAsset":
            transfer.toAddress =
              instruction.DepositAsset.beneficiary.interior.X1.AccountId32.id;
            break;
          default:
            transfer.warnings += ` - Unknown instruction name ${key}`;
        }
      });
    });
  }
}

module.exports = {
  parceXcmpInstrustions,
};
