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

import { Aptos } from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import { program } from "commander";
import fs from "fs";
import * as yup from "yup";
import { AptosExtensionsPackage } from "./packages/aptosExtensionsPackage";
import { AptosFrameworkPackage } from "./packages/aptosFrameworkPackage";
import { StablecoinPackage } from "./packages/stablecoinPackage";
import {
  checkSourceCodeExistence,
  getAptosClient,
  getPackageMetadata,
  isAptosAddress,
  isBigIntable,
  yupAptosAddress
} from "./utils";

export type ConfigFile = yup.InferType<typeof configSchema>;
type ExpectedStates = ConfigFile["expectedStates"];
type PartialExpectedStates = Omit<
  ConfigFile["expectedStates"],
  "controllers" | "minters" | "blocklist"
>;

const configSchema = yup.object().shape({
  aptosExtensionsPackageId: yup.string().required(),
  stablecoinPackageId: yup.string().required(),
  expectedStates: yup.object({
    aptosExtensionsPackage: yup
      .object({
        upgradeNumber: yup.number().required(),
        upgradePolicy: yup
          .string()
          .oneOf(["immutable", "compatible"])
          .required(),
        sourceCodeExists: yup.boolean().required()
      })
      .required(),
    stablecoinPackage: yup
      .object({
        upgradeNumber: yup.number().required(),
        upgradePolicy: yup
          .string()
          .oneOf(["immutable", "compatible"])
          .required(),
        sourceCodeExists: yup.boolean().required()
      })
      .required(),

    name: yup.string().required(),
    symbol: yup.string().required(),
    decimals: yup.number().required(),
    iconUri: yup.string().url().required(),
    projectUri: yup.string().url().required(),
    paused: yup.boolean().required(),
    initializedVersion: yup.number().required(),
    totalSupply: yup.string().required(),

    admin: yupAptosAddress().required(),
    blocklister: yupAptosAddress().required(),
    masterMinter: yupAptosAddress().required(),
    metadataUpdater: yupAptosAddress().required(),
    owner: yupAptosAddress().required(),
    pauser: yupAptosAddress().required(),
    pendingOwner: yupAptosAddress().nullable(),
    pendingAdmin: yupAptosAddress().nullable(),

    controllers: yup
      .mixed(
        (input): input is Record<string, string> =>
          typeof input === "object" &&
          Object.keys(input).every(isAptosAddress) &&
          Object.values(input).every(isAptosAddress)
      )
      .required(),
    minters: yup
      .mixed(
        (input): input is Record<string, string> =>
          typeof input === "object" &&
          Object.keys(input).every(isAptosAddress) &&
          Object.values(input).every(isBigIntable)
      )
      .required(),

    blocklist: yup.array(yup.string().required()).required()
  })
});

export default program
  .createCommand("validate-stablecoin-state")
  .description("Validates the stablecoin state")
  .argument("<string>", "Path to a validateStablecoinState config file")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .action(validateStablecoinState);

/**
 * This script validates that all configurable states on a given stablecoin
 * are correctly configured.
 * Notably, for the controllers, minters and blocklist tables, it strongly verifies
 * that known addresses are configured correctly, and no additional unknown
 * addresses have been configured.
 */
export async function validateStablecoinState(
  configFilePath: string,
  { rpcUrl }: { rpcUrl: string }
) {
  const aptos = getAptosClient(rpcUrl);
  const config = configSchema.validateSync(
    JSON.parse(fs.readFileSync(configFilePath, "utf8")),
    { abortEarly: false, strict: true }
  );

  const aptosFrameworkPackage = new AptosFrameworkPackage(aptos);
  const aptosExtensionsPackage = new AptosExtensionsPackage(
    aptos,
    config.aptosExtensionsPackageId
  );
  const stablecoinPackage = new StablecoinPackage(
    aptos,
    config.stablecoinPackageId
  );
  const stablecoinAddress =
    await stablecoinPackage.stablecoin.stablecoinAddress();

  const actualTokenState = await buildCurrentTokenState(
    aptos,
    aptosFrameworkPackage,
    aptosExtensionsPackage,
    stablecoinPackage,
    stablecoinAddress
  );

  await validateTokenState({
    aptos,
    expectedTokenState: config.expectedStates,
    actualTokenState,
    stablecoinPackage
  });

  console.log("\u001b[32mValidation success!\u001b[0m");
}

async function buildCurrentTokenState(
  aptos: Aptos,
  aptosFrameworkPackage: AptosFrameworkPackage,
  aptosExtensionsPackage: AptosExtensionsPackage,
  stablecoinPackage: StablecoinPackage,
  stablecoinAddress: string
): Promise<PartialExpectedStates> {
  const aptosExtensionsPkgMetadata = await getPackageMetadata(
    aptos,
    aptosExtensionsPackage.id.toString(),
    "AptosExtensions"
  );

  const stablecoinPkgMetadata = await getPackageMetadata(
    aptos,
    stablecoinPackage.id.toString(),
    "Stablecoin"
  );

  const faMetadata = await aptos.getAccountResource({
    accountAddress: stablecoinAddress,
    resourceType: "0x1::fungible_asset::Metadata"
  });

  const stablecoinStateResource = await aptos.getAccountResource({
    accountAddress: stablecoinAddress,
    resourceType: `${stablecoinPackage.id}::stablecoin::StablecoinState`
  });

  return {
    aptosExtensionsPackage: {
      upgradeNumber: Number(aptosExtensionsPkgMetadata.upgrade_number),
      upgradePolicy: getUpgradePolicy(
        aptosExtensionsPkgMetadata.upgrade_policy.policy
      ),
      sourceCodeExists: checkSourceCodeExistence(aptosExtensionsPkgMetadata)
    },
    stablecoinPackage: {
      upgradeNumber: Number(stablecoinPkgMetadata.upgrade_number),
      upgradePolicy: getUpgradePolicy(
        stablecoinPkgMetadata.upgrade_policy.policy
      ),
      sourceCodeExists: checkSourceCodeExistence(stablecoinPkgMetadata)
    },
    name: faMetadata.name,
    symbol: faMetadata.symbol,
    decimals: faMetadata.decimals,
    iconUri: faMetadata.icon_uri,
    projectUri: faMetadata.project_uri,
    paused: await aptosExtensionsPackage.pausable.isPaused(stablecoinAddress),
    initializedVersion: Number(stablecoinStateResource.initialized_version),

    admin: await aptosExtensionsPackage.manageable.admin(stablecoinPackage.id),
    blocklister: await stablecoinPackage.blocklistable.blocklister(),
    masterMinter: await stablecoinPackage.treasury.masterMinter(),
    metadataUpdater: await stablecoinPackage.metadata.metadataUpdater(),
    owner: await aptosExtensionsPackage.ownable.owner(stablecoinAddress),
    pauser: await aptosExtensionsPackage.pausable.pauser(stablecoinAddress),
    pendingOwner:
      await aptosExtensionsPackage.ownable.pendingOwner(stablecoinAddress),
    pendingAdmin: await aptosExtensionsPackage.manageable.pendingAdmin(
      stablecoinPackage.id
    ),

    totalSupply: (
      await aptosFrameworkPackage.fungibleAsset.supply(stablecoinAddress)
    ).toString()
  };
}

async function validateTokenState({
  aptos,
  expectedTokenState,
  actualTokenState,
  stablecoinPackage
}: {
  aptos: Aptos;
  expectedTokenState: ExpectedStates;
  actualTokenState: PartialExpectedStates;
  stablecoinPackage: StablecoinPackage;
}) {
  const { controllers, minters, blocklist, ...restExpectedStates } =
    expectedTokenState;

  assert.deepStrictEqual(restExpectedStates, actualTokenState);

  const stablecoinAddress =
    await stablecoinPackage.stablecoin.stablecoinAddress();
  const treasuryStateResource = await aptos.getAccountResource({
    accountAddress: stablecoinAddress,
    resourceType: `${stablecoinPackage.id}::treasury::TreasuryState`
  });
  const controllerCount = Number(treasuryStateResource.controllers.size);
  const minterCount = Number(treasuryStateResource.mint_allowances.size);

  const blocklistStateResource = await aptos.getAccountResource({
    accountAddress: stablecoinAddress,
    resourceType: `${stablecoinPackage.id}::blocklistable::BlocklistState`
  });
  const blocklistedCount = Number(blocklistStateResource.blocklist.length);

  await Promise.all(
    Object.entries(controllers).map(async ([controller, expectedMinter]) => {
      const actualMinter =
        await stablecoinPackage.treasury.getMinter(controller);

      if (actualMinter !== expectedMinter) {
        console.error({ [controller]: { actualMinter, expectedMinter } });
        throw new Error("Invalid controller configuration");
      }
    })
  );
  assert.strictEqual(
    controllerCount,
    Object.entries(controllers).length,
    "Additional controllers configured"
  );

  await Promise.all(
    Object.entries(minters).map(async ([minter, expectedMintAllowance]) => {
      const actualMintAllowance =
        await stablecoinPackage.treasury.mintAllowance(minter);
      const expectedMintAllowanceBigInt = BigInt(expectedMintAllowance);

      if (actualMintAllowance !== expectedMintAllowanceBigInt) {
        console.error({
          [minter]: {
            actualMintAllowance,
            expectedMintAllowance: expectedMintAllowanceBigInt
          }
        });
        throw new Error("Invalid minter configuration");
      }
    })
  );
  assert.strictEqual(
    minterCount,
    Object.entries(minters).length,
    "Additional minters configured"
  );

  await Promise.all(
    blocklist.map(async (blocklistedAddress) => {
      const isBlocklisted =
        await stablecoinPackage.blocklistable.isBlocklisted(blocklistedAddress);

      if (!isBlocklisted) {
        console.error({ [blocklistedAddress]: isBlocklisted });
        throw new Error("Invalid blocklist configuration");
      }
    })
  );
  assert.strictEqual(
    blocklistedCount,
    Object.entries(blocklist).length,
    "Additional addresses blocklisted"
  );
}

function getUpgradePolicy(policy: number): "immutable" | "compatible" {
  switch (policy) {
    case 1:
      return "compatible";
    case 2:
      return "immutable";
    default:
      throw new Error(`Unknown ${policy}`);
  }
}
