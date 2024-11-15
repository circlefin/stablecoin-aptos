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

import {
  AccountAddress,
  createObjectAddress,
  createResourceAddress
} from "@aptos-labs/ts-sdk";
import { program } from "commander";

export default program
  .createCommand("calculate-deployment-addresses")
  .description(
    "Calculate the addresses that the packages will be deployed to given some provided seed"
  )
  .requiredOption("--deployer <string>", "Deployer address")
  .requiredOption(
    "--aptos-extensions-seed <string>",
    "The deployment seed for the aptos_extensions package"
  )
  .requiredOption(
    "--stablecoin-seed <string>",
    "The deployment seed for the stablecoin package"
  )
  .action((options) => {
    const { aptosExtensionsPackageId, stablecoinPackageId, stablecoinAddress } =
      calculateDeploymentAddresses(options);

    console.log(`aptos_extensions package ID: ${aptosExtensionsPackageId}`);
    console.log(`stablecoin package ID: ${stablecoinPackageId}`);
    console.log(`stablecoin address: ${stablecoinAddress}`);
  });

export function calculateDeploymentAddresses({
  deployer,
  aptosExtensionsSeed,
  stablecoinSeed
}: {
  deployer: string;
  aptosExtensionsSeed: string;
  stablecoinSeed: string;
}) {
  const aptosExtensionsPackageId = createResourceAddress(
    AccountAddress.fromStrict(deployer),
    new Uint8Array(Buffer.from(aptosExtensionsSeed))
  );

  const stablecoinPackageId = createResourceAddress(
    AccountAddress.fromStrict(deployer),
    new Uint8Array(Buffer.from(stablecoinSeed))
  );

  const stablecoinAddress = createObjectAddress(
    stablecoinPackageId,
    new Uint8Array(Buffer.from("stablecoin"))
  );

  return {
    aptosExtensionsPackageId: aptosExtensionsPackageId.toString(),
    stablecoinPackageId: stablecoinPackageId.toString(),
    stablecoinAddress: stablecoinAddress.toString()
  };
}
