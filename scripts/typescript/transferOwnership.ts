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
import {
  getAptosClient,
  validateAddresses,
  waitForUserConfirmation
} from "./utils";
import { StablecoinPackage } from "./packages/stablecoinPackage";
import { AptosExtensionsPackage } from "./packages/aptosExtensionsPackage";

export default program
  .createCommand("transfer-ownership")
  .description("Starts a two-step ownership transfer for the stablecoin")
  .requiredOption(
    "--aptos-extensions-package-id <string>",
    "The address where the aptos_extensions package is located."
  )
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption("--owner-key <string>", "Owner's private key")
  .requiredOption("--new-owner <string>", "The new owner's address")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(transferOwnership);

export async function transferOwnership({
  aptosExtensionsPackageId,
  stablecoinPackageId,
  ownerKey,
  newOwner,
  rpcUrl
}: {
  aptosExtensionsPackageId: string;
  stablecoinPackageId: string;
  ownerKey: string;
  newOwner: string;
  rpcUrl: string;
}) {
  validateAddresses(aptosExtensionsPackageId, stablecoinPackageId, newOwner);

  const aptos = getAptosClient(rpcUrl);
  const aptosExtensionsPackage = new AptosExtensionsPackage(
    aptos,
    aptosExtensionsPackageId
  );
  const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);

  const owner = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(ownerKey)
  });

  console.log(
    `Starting the Owner role transfer from ${owner.accountAddress.toString()} to ${newOwner}...`
  );
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  const stablecoinAddress =
    await stablecoinPackage.stablecoin.stablecoinAddress();
  await aptosExtensionsPackage.ownable.transferOwnership(
    owner,
    stablecoinAddress,
    newOwner
  );
}
