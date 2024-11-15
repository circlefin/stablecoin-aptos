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

import { program } from "commander";
import { verifyPackage } from "./verifyPackage";

export default program
  .createCommand("verify-v1-packages")
  .description(
    "Verify bytecode and metadata of deployed packages match local source code."
  )
  .requiredOption(
    "--aptos-extensions-package-id <string>",
    "The address where the aptos_extenisons package is located."
  )
  .requiredOption(
    "--stablecoin-package-id <string>",
    "The address where the stablecoin package is located."
  )
  .requiredOption("--deployer <string>", "Address of the deployer account.")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .option(
    "--source-uploaded",
    "Whether source code verification was enabled during package deployment."
  )
  .action(async (options) => {
    const results = await verifyV1Packages(options);
    console.log(results);
  });

export async function verifyV1Packages({
  deployer,
  aptosExtensionsPackageId,
  stablecoinPackageId,
  rpcUrl,
  sourceUploaded = false
}: {
  deployer: string;
  aptosExtensionsPackageId: string;
  stablecoinPackageId: string;
  rpcUrl: string;
  sourceUploaded?: boolean;
}) {
  const aptosExtensionsPkgNamedAddresses = [
    { name: "deployer", address: deployer }
  ];
  const aptosExtensionsInputParams = {
    packageName: "aptos_extensions",
    packageId: aptosExtensionsPackageId,
    namedDeps: aptosExtensionsPkgNamedAddresses,
    sourceUploaded,
    rpcUrl
  };
  const aptosExtensionsResult = await verifyPackage(aptosExtensionsInputParams);

  const stablecoinPkgNamedAddresses = [
    { name: "deployer", address: deployer },
    { name: "aptos_extensions", address: aptosExtensionsPackageId }
  ];
  const stablecoinInputParams = {
    packageName: "stablecoin",
    packageId: stablecoinPackageId,
    namedDeps: stablecoinPkgNamedAddresses,
    sourceUploaded,
    rpcUrl
  };
  const stablecoinResult = await verifyPackage(stablecoinInputParams);

  return [aptosExtensionsResult, stablecoinResult];
}
