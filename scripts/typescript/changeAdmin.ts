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

export default program
  .createCommand("change-admin")
  .description("Starts a two-step admin transfer for the package")
  .requiredOption(
    "--aptos-extensions-package-id <string>",
    "The address where the aptos_extensions package is located."
  )
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption("--admin-key <string>", "Admin's private key")
  .requiredOption("--new-admin <string>", "The new admin's address")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(changeAdmin);

export async function changeAdmin({
  aptosExtensionsPackageId,
  stablecoinPackageId,
  adminKey,
  newAdmin,
  rpcUrl
}: {
  aptosExtensionsPackageId: string;
  stablecoinPackageId: string;
  adminKey: string;
  newAdmin: string;
  rpcUrl: string;
}) {
  validateAddresses(aptosExtensionsPackageId, stablecoinPackageId, newAdmin);

  const aptos = getAptosClient(rpcUrl);
  const aptosExtensionsPackage = new AptosExtensionsPackage(
    aptos,
    aptosExtensionsPackageId
  );

  const admin = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(adminKey)
  });

  console.log(
    `Starting the Admin role transfer from ${admin.accountAddress.toString()} to ${newAdmin}...`
  );
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  await aptosExtensionsPackage.manageable.changeAdmin(
    admin,
    stablecoinPackageId,
    newAdmin
  );
}
