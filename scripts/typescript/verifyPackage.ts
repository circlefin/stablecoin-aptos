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

import { strict as assert } from "assert";
import { execSync } from "child_process";
import { program } from "commander";
import { getAptosClient, getPackageBytecode, validateAddresses } from "./utils";
import {
  buildPackage,
  formatNamedAddresses,
  getIncludedArtifactsSetting,
  NamedAddress,
  parseNamedAddresses
} from "./utils/deployUtils";

export default program
  .createCommand("verify-package")
  .description(
    "Verify bytecode and metadata of a deployed package match local source code."
  )
  .requiredOption(
    "--package-name <string>",
    "The name of the package to verify."
  )
  .requiredOption(
    "--package-id <string>",
    "The address where the package is located."
  )
  .requiredOption(
    "--named-deps <string>",
    "Named dependency addresses of the deployed package."
  )
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .option(
    "--source-uploaded",
    "Whether source code verification was enabled during package deployment."
  )
  .action(async (options) => {
    const namedDeps = parseNamedAddresses(options.namedDeps);
    const result = await verifyPackage(Object.assign(options, { namedDeps }));
    console.log(result);
  });

type BytecodeVerificationResult = {
  packageName: string;
  bytecodeVerified: boolean;
  metadataVerified: boolean;
};

export async function verifyPackage({
  packageName,
  packageId,
  namedDeps,
  rpcUrl,
  sourceUploaded
}: {
  packageName: string;
  packageId: string;
  namedDeps: NamedAddress[];
  rpcUrl: string;
  sourceUploaded?: boolean;
}): Promise<BytecodeVerificationResult> {
  validateAddresses(packageId);

  const aptos = getAptosClient(rpcUrl);
  const namedAddresses = [
    ...namedDeps,
    { name: packageName, address: packageId }
  ];

  const localModuleBytecode = (
    await buildPackage(
      packageName,
      namedAddresses,
      false /* value does not affect verification */
    )
  ).bytecode;
  const remoteModuleBytecode = await getPackageBytecode(aptos, packageId);

  // Comparing remote bytecode against local compilation
  // Local bytecode list is arranged according to the module dependency hierarchy
  // For simplicity, we compare the sorted list of bytecode
  localModuleBytecode.sort();
  remoteModuleBytecode.sort();

  let bytecodeVerified = false;
  try {
    assert.deepStrictEqual(localModuleBytecode, remoteModuleBytecode);
    bytecodeVerified = true;
  } catch (e) {
    console.error(e);
  }

  // Begin verifying package metadata
  // Setting to enable or disable source code verification
  const verifyMetadataCommand = `make verify-metadata \
    package="${packageName}" \
    package_id="${packageId}" \
    url="${rpcUrl}" \
    named_addresses="${formatNamedAddresses(namedAddresses)}" \
    included_artifacts="${getIncludedArtifactsSetting(sourceUploaded)}"`;

  const result = execSync(verifyMetadataCommand, { encoding: "utf-8" });
  const metadataVerified = result.includes(
    "Successfully verified source of package"
  );

  return { packageName, bytecodeVerified, metadataVerified };
}
