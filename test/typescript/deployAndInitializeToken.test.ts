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

import { AccountAddressInput, Ed25519Account } from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import sinon, { SinonStub } from "sinon";
import { deployAndInitializeToken } from "../../scripts/typescript/deployAndInitializeToken";
import {
  getAptosClient,
  getPackageMetadata,
  LOCAL_RPC_URL
} from "../../scripts/typescript/utils";
import * as tokenConfigModule from "../../scripts/typescript/utils/tokenConfig";
import { TokenConfig } from "../../scripts/typescript/utils/tokenConfig";
import { generateKeypairs, validateSourceCodeExistence } from "./testUtils";
import { StablecoinPackage } from "../../scripts/typescript/packages/stablecoinPackage";
import { generateKeypair } from "../../scripts/typescript/generateKeypair";
import { AptosExtensionsPackage } from "../../scripts/typescript/packages/aptosExtensionsPackage";

describe("deployAndInitializeToken E2E test", () => {
  const TEST_TOKEN_CONFIG_PATH = "path/to/token_config.json";

  const aptos = getAptosClient(LOCAL_RPC_URL);

  let readTokenConfigStub: SinonStub;
  let tokenConfig: TokenConfig;

  let deployer: Ed25519Account;
  let admin: Ed25519Account;
  let blocklister: Ed25519Account;
  let masterMinter: Ed25519Account;
  let metadataUpdater: Ed25519Account;
  let owner: Ed25519Account;
  let pauser: Ed25519Account;
  let controller: Ed25519Account;
  let minter: Ed25519Account;

  beforeEach(async () => {
    readTokenConfigStub = sinon.stub(tokenConfigModule, "readTokenConfig");
    deployer = await generateKeypair({ prefund: true });

    [
      admin,
      blocklister,
      masterMinter,
      metadataUpdater,
      owner,
      pauser,
      controller,
      minter
    ] = await generateKeypairs(8, false);

    tokenConfig = {
      name: "USDC",
      symbol: "USDC",
      decimals: 6,
      iconUri: "https://circle.com/usdc-icon",
      projectUri: "https://circle.com/usdc",

      admin: admin.accountAddress.toString(),
      blocklister: blocklister.accountAddress.toString(),
      masterMinter: masterMinter.accountAddress.toString(),
      metadataUpdater: metadataUpdater.accountAddress.toString(),
      owner: owner.accountAddress.toString(),
      pauser: pauser.accountAddress.toString(),

      controllers: {
        [controller.accountAddress.toString()]: minter.accountAddress.toString()
      },
      minters: {
        [minter.accountAddress.toString()]: "1000000000"
      }
    };

    readTokenConfigStub.withArgs(TEST_TOKEN_CONFIG_PATH).returns(tokenConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should succeed when source code verification is enabled", async () => {
    const verifySource = true;

    const result = await deployAndInitializeToken({
      deployerKey: deployer.privateKey.toString(),
      rpcUrl: LOCAL_RPC_URL,
      verifySource,
      tokenConfigPath: TEST_TOKEN_CONFIG_PATH
    });

    await validatePostState(result, deployer.accountAddress, verifySource);
  });

  it("should succeed when source code verification is disabled", async () => {
    const verifySource = false;

    const result = await deployAndInitializeToken({
      deployerKey: deployer.privateKey.toString(),
      rpcUrl: LOCAL_RPC_URL,
      verifySource,
      tokenConfigPath: TEST_TOKEN_CONFIG_PATH
    });

    await validatePostState(result, deployer.accountAddress, verifySource);
  });

  async function validatePostState(
    inputs: {
      aptosExtensionsPackageId: string;
      stablecoinPackageId: string;
      stablecoinAddress: string;
    },
    deployer: AccountAddressInput,
    sourceCodeExists: boolean
  ) {
    const { stablecoinAddress, aptosExtensionsPackageId, stablecoinPackageId } =
      inputs;
    const aptosExtensionsPackage = new AptosExtensionsPackage(
      aptos,
      aptosExtensionsPackageId
    );
    const stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);

    // Ensure that AptosExtensions is published correctly.
    const aptosExtensionsPkgMetadata = await getPackageMetadata(
      aptos,
      aptosExtensionsPackageId,
      "AptosExtensions"
    );
    assert.strictEqual(aptosExtensionsPkgMetadata.name, "AptosExtensions");
    assert.strictEqual(aptosExtensionsPkgMetadata.upgrade_number, "0");
    assert.strictEqual(aptosExtensionsPkgMetadata.upgrade_policy.policy, 2); // Immutable package
    validateSourceCodeExistence(aptosExtensionsPkgMetadata, sourceCodeExists);

    // Ensure that Stablecoin is published correctly.
    const stablecoinPkgMetadata = await getPackageMetadata(
      aptos,
      stablecoinPackageId,
      "Stablecoin"
    );
    assert.strictEqual(stablecoinPkgMetadata.name, "Stablecoin");
    assert.strictEqual(stablecoinPkgMetadata.upgrade_number, "0");
    assert.strictEqual(stablecoinPkgMetadata.upgrade_policy.policy, 1); // Upgradeable package
    validateSourceCodeExistence(aptosExtensionsPkgMetadata, sourceCodeExists);

    // Ensure that the FungibleAsset's metadata is set up correctly.
    const metadata = await aptos.getAccountResource({
      accountAddress: stablecoinAddress,
      resourceType: "0x1::fungible_asset::Metadata"
    });
    assert.strictEqual(metadata.name, tokenConfig.name);
    assert.strictEqual(metadata.symbol, tokenConfig.symbol);
    assert.strictEqual(metadata.decimals, tokenConfig.decimals);
    assert.strictEqual(metadata.icon_uri, tokenConfig.iconUri);
    assert.strictEqual(metadata.project_uri, tokenConfig.projectUri);

    // Ensure that controllers are set up.
    for (const [controller, minter] of Object.entries(
      tokenConfig.controllers
    )) {
      assert.strictEqual(
        await stablecoinPackage.treasury.getMinter(controller),
        minter
      );
    }

    // Ensure that minters are set up.
    for (const [minter, mintAllowance] of Object.entries(tokenConfig.minters)) {
      assert.strictEqual(
        await stablecoinPackage.treasury.mintAllowance(minter),
        BigInt(mintAllowance)
      );
    }

    // Ensure that the deployer is not a controller.
    assert.strictEqual(
      await stablecoinPackage.treasury.getMinter(deployer),
      null
    );

    // Ensure that the privileged roles are rotated.
    assert.strictEqual(
      await stablecoinPackage.treasury.masterMinter(),
      masterMinter.accountAddress.toString()
    );
    assert.strictEqual(
      await stablecoinPackage.blocklistable.blocklister(),
      blocklister.accountAddress.toString()
    );
    assert.strictEqual(
      await stablecoinPackage.metadata.metadataUpdater(),
      metadataUpdater.accountAddress.toString()
    );
    assert.strictEqual(
      await aptosExtensionsPackage.pausable.pauser(stablecoinAddress),
      pauser.accountAddress.toString()
    );
    assert.strictEqual(
      await aptosExtensionsPackage.ownable.pendingOwner(stablecoinAddress),
      owner.accountAddress.toString()
    );
    assert.strictEqual(
      await aptosExtensionsPackage.manageable.pendingAdmin(stablecoinPackageId),
      admin.accountAddress.toString()
    );
  }
});
