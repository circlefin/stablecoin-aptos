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
  Account,
  Aptos,
  Ed25519Account,
  Ed25519PrivateKey
} from "@aptos-labs/ts-sdk";
import { program } from "commander";
import { inspect } from "util";
import { StablecoinPackage } from "./packages/stablecoinPackage";
import { getAptosClient, waitForUserConfirmation } from "./utils";
import { publishPackageToResourceAccount } from "./utils/deployUtils";
import { readTokenConfig, TokenConfig } from "./utils/tokenConfig";
import { AptosExtensionsPackage } from "./packages/aptosExtensionsPackage";

export default program
  .createCommand("deploy-and-initialize-token")
  .description("Deploy all packages and initialize the token")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .requiredOption("--deployer-key <string>", "Deployer private key")
  .requiredOption("--token-config-path <string>", "Path to token config file")
  .option(
    "--verify-source",
    "Whether source code verification is enabled",
    false
  )
  .action(async (options) => {
    await deployAndInitializeToken(options);
  });

export async function deployAndInitializeToken({
  rpcUrl,
  deployerKey,
  tokenConfigPath,
  verifySource
}: {
  rpcUrl: string;
  deployerKey: string;
  tokenConfigPath: string;
  verifySource?: boolean;
}): Promise<{
  aptosExtensionsPackageId: string;
  stablecoinPackageId: string;
  stablecoinAddress: string;
}> {
  const aptos = getAptosClient(rpcUrl);

  const deployer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(deployerKey)
  });
  console.log(`Deployer account: ${deployer.accountAddress}`);

  const tokenConfig = readTokenConfig(tokenConfigPath);
  console.log(
    `Creating stablecoin with config`,
    inspect(tokenConfig, false, 8, true)
  );
  if (!(await waitForUserConfirmation())) {
    process.exit(1);
  }

  console.log("Publishing packages...");
  const { aptosExtensionsPackageId, stablecoinPackageId } =
    await publishPackages(aptos, deployer, !!verifySource);

  const aptosExtensionsPackage = new AptosExtensionsPackage(
    aptos,
    aptosExtensionsPackageId
  );
  const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);
  const stablecoinAddress =
    await stablecoinPackage.stablecoin.stablecoinAddress();

  console.log(
    `Deployed aptos_extensions package at ${aptosExtensionsPackageId}`
  );
  console.log(`Deployed stablecoin package at ${stablecoinPackageId}`);
  console.log(
    `Stablecoin object for ${tokenConfig.symbol} created at ${stablecoinAddress}`
  );

  console.log("Initializing stablecoin");
  await initializeStablecoin(
    aptosExtensionsPackage,
    stablecoinPackage,
    stablecoinAddress,
    deployer,
    tokenConfig
  );
  console.log(`Stablecoin initialized for ${tokenConfig.symbol}`);

  return {
    aptosExtensionsPackageId,
    stablecoinPackageId,
    stablecoinAddress
  };
}

async function publishPackages(
  aptos: Aptos,
  deployer: Ed25519Account,
  verifySource: boolean
) {
  const [aptosExtensionsPackageId] = await publishPackageToResourceAccount({
    aptos,
    deployer,
    packageName: "aptos_extensions",
    seed: new Uint8Array(Buffer.from("aptos_extensions")),
    namedDeps: [
      { name: "deployer", address: deployer.accountAddress.toString() }
    ],
    verifySource
  });

  const [stablecoinPackageId] = await publishPackageToResourceAccount({
    aptos,
    deployer,
    packageName: "stablecoin",
    namedDeps: [
      { name: "aptos_extensions", address: aptosExtensionsPackageId },
      { name: "deployer", address: deployer.accountAddress.toString() }
    ],
    seed: new Uint8Array(Buffer.from("stablecoin")),
    verifySource
  });

  return { aptosExtensionsPackageId, stablecoinPackageId };
}

async function initializeStablecoin(
  aptosExtensionsPackage: AptosExtensionsPackage,
  stablecoinPackage: StablecoinPackage,
  stablecoinAddress: string,
  deployer: Ed25519Account,
  tokenConfig: TokenConfig
) {
  // Initialize the stablecoin.
  await stablecoinPackage.stablecoin.initializeV1(
    deployer,
    tokenConfig.name,
    tokenConfig.symbol,
    tokenConfig.decimals,
    tokenConfig.iconUri,
    tokenConfig.projectUri
  );

  // Configure the minters.
  for (const [minter, mintAllowance] of Object.entries(tokenConfig.minters)) {
    // Configure deployer as the temporary controller for the minter.
    await stablecoinPackage.treasury.configureController(
      deployer,
      deployer.accountAddress,
      minter
    );

    // Configure the minter.
    await stablecoinPackage.treasury.configureMinter(
      deployer,
      BigInt(mintAllowance)
    );
  }

  // Remove the deployer from the controllers list, if it was configured as a temporary controller.
  if (Object.keys(tokenConfig.minters).length > 0) {
    await stablecoinPackage.treasury.removeController(
      deployer,
      deployer.accountAddress
    );
  }

  // Configure the controllers.
  for (const [controller, minter] of Object.entries(tokenConfig.controllers)) {
    await stablecoinPackage.treasury.configureController(
      deployer,
      controller,
      minter
    );
  }

  // Rotate privileged roles to the addresses defined in the config.
  await stablecoinPackage.treasury.updateMasterMinter(
    deployer,
    tokenConfig.masterMinter
  );
  await stablecoinPackage.blocklistable.updateBlocklister(
    deployer,
    tokenConfig.blocklister
  );
  await stablecoinPackage.metadata.updateMetadataUpdater(
    deployer,
    tokenConfig.metadataUpdater
  );
  await aptosExtensionsPackage.pausable.updatePauser(
    deployer,
    stablecoinAddress,
    tokenConfig.pauser
  );

  // Start the two-step ownership and admin transfer.
  // Note that the recipients of these roles will need to separately
  // submit a transaction that accepts these roles.
  await aptosExtensionsPackage.ownable.transferOwnership(
    deployer,
    stablecoinAddress,
    tokenConfig.owner
  );
  await aptosExtensionsPackage.manageable.changeAdmin(
    deployer,
    stablecoinPackage.id,
    tokenConfig.admin
  );
}
