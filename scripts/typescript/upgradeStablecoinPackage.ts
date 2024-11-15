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
import { inspect } from "util";
import { AptosExtensionsPackage } from "./packages/aptosExtensionsPackage";
import {
  getAptosClient,
  validateAddresses,
  waitForUserConfirmation
} from "./utils";
import { readPublishPayload } from "./utils/publishPayload";

export default program
  .createCommand("upgrade-stablecoin-package")
  .description("Upgrade the stablecoin package")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .requiredOption("--admin-key <string>", "Admin private key")
  .requiredOption(
    "--payload-file-path <string>",
    "The publish package JSON payload file path"
  )
  .requiredOption(
    "--aptos-extensions-package-id <string>",
    "aptos_extensions package address"
  )
  .requiredOption(
    "--stablecoin-package-id <string>",
    "stablecoin package address"
  )
  .action(upgradeStablecoinPackage);

export async function upgradeStablecoinPackage({
  adminKey,
  rpcUrl,
  payloadFilePath,
  aptosExtensionsPackageId,
  stablecoinPackageId
}: {
  adminKey: string;
  rpcUrl: string;
  payloadFilePath: string;
  aptosExtensionsPackageId: string;
  stablecoinPackageId: string;
}): Promise<void> {
  validateAddresses(aptosExtensionsPackageId, stablecoinPackageId);

  const aptos = getAptosClient(rpcUrl);
  const aptosExtensionsPackage = new AptosExtensionsPackage(
    aptos,
    aptosExtensionsPackageId
  );

  const admin = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(adminKey)
  });

  console.log(`Admin account: ${admin.accountAddress}`);

  const payload = readPublishPayload(payloadFilePath);
  console.log(
    "Updating package using payload",
    inspect(payload, false, 8, true)
  );

  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  const metadataBytes = payload.args[0].value;
  const bytecode = payload.args[1].value;

  await aptosExtensionsPackage.upgradable.upgradePackage(
    admin,
    stablecoinPackageId,
    metadataBytes,
    bytecode
  );

  console.log(`Package upgraded successfully!`);
}
