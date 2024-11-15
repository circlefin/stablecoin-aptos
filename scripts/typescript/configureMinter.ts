/**
 * Copyright 2024 Circle Internet Group, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { program } from "commander";
import { AptosFrameworkPackage } from "./packages/aptosFrameworkPackage";
import { StablecoinPackage } from "./packages/stablecoinPackage";
import {
  getAptosClient,
  MAX_U64,
  validateAddresses,
  waitForUserConfirmation
} from "./utils";

export default program
  .createCommand("configure-minter")
  .description("Configures a minter")
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption(
    "--controller-key <string>",
    "Minter's controller private key"
  )
  .requiredOption(
    "--mint-allowance <string>",
    "The mint allowance (in subunits) to set"
  )
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(configureMinter);

export async function configureMinter({
  stablecoinPackageId,
  controllerKey,
  mintAllowance,
  rpcUrl
}: {
  stablecoinPackageId: string;
  controllerKey: string;
  mintAllowance: string;
  rpcUrl: string;
}) {
  validateAddresses(stablecoinPackageId);
  if (BigInt(mintAllowance) > MAX_U64) {
    throw new Error("Mint allowance exceeds MAX_U64");
  }

  const aptos = getAptosClient(rpcUrl);
  const aptosFrameworkPackage = new AptosFrameworkPackage(aptos);
  const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);

  const controller = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(controllerKey)
  });
  const minter = await stablecoinPackage.treasury.getMinter(
    controller.accountAddress
  );

  const stablecoinAddress =
    await stablecoinPackage.stablecoin.stablecoinAddress();
  const decimals =
    await aptosFrameworkPackage.fungibleAsset.getDecimals(stablecoinAddress);

  console.log(
    `Setting minter ${minter} allowance to $${BigInt(mintAllowance) / BigInt(10 ** decimals)}...`
  );
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  await stablecoinPackage.treasury.configureMinter(
    controller,
    BigInt(mintAllowance)
  );
}
