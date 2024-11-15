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

export default program
  .createCommand("configure-controller")
  .description("Configures a controller")
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption("--master-minter-key <string>", "Master Minter's private key")
  .requiredOption("--controller <string>", "The controller's address")
  .requiredOption("--minter <string>", "The minter's address")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(configureController);

export async function configureController({
  stablecoinPackageId,
  masterMinterKey,
  controller,
  minter,
  rpcUrl
}: {
  stablecoinPackageId: string;
  masterMinterKey: string;
  controller: string;
  minter: string;
  rpcUrl: string;
}) {
  validateAddresses(stablecoinPackageId, controller, minter);

  const aptos = getAptosClient(rpcUrl);
  const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);

  const masterMinter = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(masterMinterKey)
  });

  console.log(`Configuring controller ${controller} for minter ${minter}...`);
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  await stablecoinPackage.treasury.configureController(
    masterMinter,
    controller,
    minter
  );
}
