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
  .createCommand("update-metadata-updater")
  .description("Updates the Metadata Updater for the stablecoin")
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption("--owner-key <string>", "Owner's private key")
  .requiredOption(
    "--new-metadata-updater <string>",
    "The new Metadata Updater's address"
  )
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(updateMetadataUpdater);

export async function updateMetadataUpdater({
  stablecoinPackageId,
  ownerKey,
  newMetadataUpdater,
  rpcUrl
}: {
  stablecoinPackageId: string;
  ownerKey: string;
  newMetadataUpdater: string;
  rpcUrl: string;
}) {
  validateAddresses(stablecoinPackageId, newMetadataUpdater);

  const aptos = getAptosClient(rpcUrl);
  const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);

  const owner = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(ownerKey)
  });
  const metadataUpdater = await stablecoinPackage.metadata.metadataUpdater();

  console.log(
    `Updating the Metadata Updater from ${metadataUpdater} to ${newMetadataUpdater}...`
  );
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  await stablecoinPackage.metadata.updateMetadataUpdater(
    owner,
    newMetadataUpdater
  );
}
