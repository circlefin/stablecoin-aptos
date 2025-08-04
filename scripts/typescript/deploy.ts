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
import { getAptosClient, waitForUserConfirmation } from "./utils";
import {
  publishPackageToResourceAccount,
  NamedAddress,
  parseNamedAddresses
} from "./utils/deployUtils";

export default program
  .createCommand("deploy")
  .description("Builds and deploys a package")
  .argument("<string>", "Name of package to deploy")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .requiredOption("--deployer-key <string>", "Deployer private key")
  .requiredOption(
    "--seed <string>",
    "The seed for calculating the deployment address"
  )
  .requiredOption(
    "--named-deps <string>",
    "Named dependency addresses of the deployed package."
  )
  .option(
    "--verify-source",
    "Whether source code verification is enabled",
    false
  )
  .action(async (packageName, options) => {
    const namedDeps = parseNamedAddresses(options.namedDeps);
    await deploy(packageName, { ...options, namedDeps });
  });

export async function deploy(
  packageName: string,
  {
    rpcUrl,
    deployerKey,
    seed,
    namedDeps,
    verifySource
  }: {
    rpcUrl: string;
    deployerKey: string;
    seed: string;
    namedDeps: NamedAddress[];
    verifySource?: boolean;
  }
) {
  const aptos = getAptosClient(rpcUrl);

  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(deployerKey)
  });
  console.log(`Deployer account: ${deployer.accountAddress}`);

  console.log(`Publishing package ${packageName}...`);
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  const [packageId] = await publishPackageToResourceAccount({
    aptos,
    deployer,
    packageName,
    namedDeps,
    seed: new Uint8Array(Buffer.from(seed)),
    verifySource: !!verifySource
  });

  console.log(`Deployed package to ${packageId}`);
}
