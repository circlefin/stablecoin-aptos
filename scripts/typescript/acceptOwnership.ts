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
import { StablecoinPackage } from "./packages/stablecoinPackage";
import { getAptosClient, validateAddresses } from "./utils";

export default program
  .createCommand("accept-ownership")
  .description("Completes the two-step ownership transfer for the stablecoin")
  .requiredOption(
    "--aptos-extensions-package-id <string>",
    "The address where the aptos_extensions package is located."
  )
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption("--new-owner-key <string>", "New owner's private key")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(acceptOwnership);

export async function acceptOwnership({
  aptosExtensionsPackageId,
  stablecoinPackageId,
  newOwnerKey,
  rpcUrl
}: {
  aptosExtensionsPackageId: string;
  stablecoinPackageId: string;
  newOwnerKey: string;
  rpcUrl: string;
}) {
  validateAddresses(aptosExtensionsPackageId, stablecoinPackageId);

  const aptos = getAptosClient(rpcUrl);
  const aptosExtensionsPackage = new AptosExtensionsPackage(
    aptos,
    aptosExtensionsPackageId
  );
  const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);

  const newOwner = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(newOwnerKey)
  });

  console.log(
    `Accepting the Owner role transfer to ${newOwner.accountAddress.toString()}...`
  );

  const stablecoinAddress =
    await stablecoinPackage.stablecoin.stablecoinAddress();
  await aptosExtensionsPackage.ownable.acceptOwnership(
    newOwner,
    stablecoinAddress
  );
}
