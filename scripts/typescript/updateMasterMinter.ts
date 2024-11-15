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
import { StablecoinPackage } from "./packages/stablecoinPackage";
import {
  getAptosClient,
  validateAddresses,
  waitForUserConfirmation
} from "./utils";

export default program
  .createCommand("update-master-minter")
  .description("Updates the Master Minter for the stablecoin")
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption("--owner-key <string>", "Owner's private key")
  .requiredOption(
    "--new-master-minter <string>",
    "The new Master Minter's address"
  )
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(updateMasterMinter);

export async function updateMasterMinter({
  stablecoinPackageId,
  ownerKey,
  newMasterMinter,
  rpcUrl
}: {
  stablecoinPackageId: string;
  ownerKey: string;
  newMasterMinter: string;
  rpcUrl: string;
}) {
  validateAddresses(stablecoinPackageId, newMasterMinter);

  const aptos = getAptosClient(rpcUrl);
  const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);

  const owner = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(ownerKey)
  });
  const masterMinter = await stablecoinPackage.treasury.masterMinter();

  console.log(
    `Updating the Master Minter from ${masterMinter} to ${newMasterMinter}...`
  );
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  await stablecoinPackage.treasury.updateMasterMinter(owner, newMasterMinter);
}
