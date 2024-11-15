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
import { AptosExtensionsPackage } from "./packages/aptosExtensionsPackage";
import {
  getAptosClient,
  validateAddresses,
  waitForUserConfirmation
} from "./utils";
import { StablecoinPackage } from "./packages/stablecoinPackage";

export default program
  .createCommand("update-pauser")
  .description("Updates the pauser for the stablecoin")
  .requiredOption(
    "--aptos-extensions-package-id <string>",
    "The address where the aptos_extensions package is located."
  )
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption("--owner-key <string>", "Owner's private key")
  .requiredOption("--new-pauser <string>", "The new pauser's address")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(updatePauser);

export async function updatePauser({
  aptosExtensionsPackageId,
  stablecoinPackageId,
  ownerKey,
  newPauser,
  rpcUrl
}: {
  aptosExtensionsPackageId: string;
  stablecoinPackageId: string;
  ownerKey: string;
  newPauser: string;
  rpcUrl: string;
}) {
  validateAddresses(aptosExtensionsPackageId, stablecoinPackageId, newPauser);

  const aptos = getAptosClient(rpcUrl);
  const aptosExtensionsPackage = new AptosExtensionsPackage(
    aptos,
    aptosExtensionsPackageId
  );
  const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);
  const stablecoinAddress =
    await stablecoinPackage.stablecoin.stablecoinAddress();

  const owner = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(ownerKey)
  });
  const pauser =
    await aptosExtensionsPackage.pausable.pauser(stablecoinAddress);

  console.log(`Updating the Pauser from ${pauser} to ${newPauser}...`);
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  await aptosExtensionsPackage.pausable.updatePauser(
    owner,
    stablecoinAddress,
    newPauser
  );
}
