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

import { Aptos, Ed25519Account, MoveVector } from "@aptos-labs/ts-sdk";
import fs from "fs";
import path from "path";
import { verifyPackage } from "../../scripts/typescript/verifyPackage";
import { generateKeypair } from "../../scripts/typescript/generateKeypair";
import {
  executeTransaction,
  getAptosClient,
  LOCAL_RPC_URL,
  REPOSITORY_ROOT
} from "../../scripts/typescript/utils";

import { strict as assert } from "assert";
import { calculateDeploymentAddresses } from "../../scripts/typescript/calculateDeploymentAddresses";
import {
  buildPackage,
  publishPackageToResourceAccount
} from "../../scripts/typescript/utils/deployUtils";

describe("Verify package", () => {
  const aptos: Aptos = getAptosClient();

  let deployer: Ed25519Account;
  let deployerAddress: string;
  let aptosExtensionsPackageId: string;
  let stablecoinPackageId: string;

  beforeEach(async () => {
    deployer = await generateKeypair({ prefund: true });
    deployerAddress = deployer.accountAddress.toString();
    ({ aptosExtensionsPackageId, stablecoinPackageId } =
      calculateDeploymentAddresses({
        deployer: deployerAddress,
        aptosExtensionsSeed: "aptos_extensions",
        stablecoinSeed: "stablecoin"
      }));
  });

  it("Should succeed when verifying matching bytecode and metadata", async () => {
    await publishDefaultAptosExtensionsPkg();
    await publishDefaultStablecoinPkg();

    const aptosExtensionsResult = await verifyPackage({
      packageName: "aptos_extensions",
      packageId: aptosExtensionsPackageId,
      namedDeps: [{ name: "deployer", address: deployerAddress }],
      rpcUrl: LOCAL_RPC_URL,
      sourceUploaded: false
    });
    const stablecoinResult = await verifyPackage({
      packageName: "stablecoin",
      packageId: stablecoinPackageId,
      namedDeps: [
        { name: "deployer", address: deployerAddress },
        { name: "aptos_extensions", address: aptosExtensionsPackageId }
      ],
      rpcUrl: LOCAL_RPC_URL,
      sourceUploaded: false
    });

    assert.deepEqual(aptosExtensionsResult, {
      packageName: "aptos_extensions",
      bytecodeVerified: true,
      metadataVerified: true
    });
    assert.deepEqual(stablecoinResult, {
      packageName: "stablecoin",
      bytecodeVerified: true,
      metadataVerified: true
    });
  });

  it("Should report failure when package deps do not match", async () => {
    const defaultAptosExtensionsPackageId = aptosExtensionsPackageId;
    await publishDefaultAptosExtensionsPkg();

    // Deploy stablecoin package with alternative aptos_extensions package ID
    const alternativeSeed = "aptos_extensions_alternative";
    const alternativeAptosExtensionsPackageId = calculateDeploymentAddresses({
      deployer: deployerAddress,
      aptosExtensionsSeed: alternativeSeed,
      stablecoinSeed: "" /* not needed */
    }).aptosExtensionsPackageId;

    await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "aptos_extensions",
      seed: Uint8Array.from(Buffer.from(alternativeSeed)),
      namedDeps: [{ name: "deployer", address: deployerAddress }],
      verifySource: false
    });
    await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "stablecoin",
      seed: Uint8Array.from(Buffer.from("stablecoin")),
      namedDeps: [
        { name: "deployer", address: deployerAddress },
        {
          name: "aptos_extensions",
          address: alternativeAptosExtensionsPackageId
        }
      ],
      verifySource: false
    });

    const result = await verifyPackage({
      packageName: "stablecoin",
      packageId: stablecoinPackageId,
      namedDeps: [
        { name: "deployer", address: deployerAddress },
        { name: "aptos_extensions", address: defaultAptosExtensionsPackageId }
      ],
      rpcUrl: LOCAL_RPC_URL,
      sourceUploaded: false
    });

    assert.deepEqual(result, {
      packageName: "stablecoin",
      bytecodeVerified: false,
      metadataVerified: false
    });
  });

  it("Should report failure when package bytecode does not match", async () => {
    // This file contains bytecode compiled from an altered version of the aptos_extensions package
    const maliciousBytecodeFilePath = path.join(
      REPOSITORY_ROOT,
      "test/typescript/testdata/malicious_bytecode.json"
    );
    const {
      deployer: originalDeployer,
      aptos_extensions_package_id: originalAptosExtensionsPackageId,
      bytecode: rawMaliciousBytecode
    } = JSON.parse(fs.readFileSync(maliciousBytecodeFilePath).toString());

    // Replace dependency addresses with current deployer and aptos_extensions package ID
    // Without this step, the bytecode would not be deployable
    const maliciousBytecode = rawMaliciousBytecode.map(
      (moduleBytecode: string) =>
        moduleBytecode
          .replace(
            originalDeployer.replace(/^0x/, ""),
            deployerAddress.replace(/^0x/, "")
          )
          .replace(
            originalAptosExtensionsPackageId.replace(/^0x/, ""),
            aptosExtensionsPackageId.replace(/^0x/, "")
          )
    );

    // Calculate metadata bytes from unaltered package
    const { metadataBytes } = await buildPackage(
      "aptos_extensions",
      [
        { name: "deployer", address: deployerAddress },
        { name: "aptos_extensions", address: aptosExtensionsPackageId }
      ],
      false
    );

    // Deploy package with innocent (fake) metadata and malicious bytecode
    await executeTransaction({
      aptos,
      sender: deployer,
      data: {
        function:
          "0x1::resource_account::create_resource_account_and_publish_package",
        functionArguments: [
          MoveVector.U8(Uint8Array.from(Buffer.from("aptos_extensions"))),
          MoveVector.U8(metadataBytes),
          new MoveVector(maliciousBytecode.map(MoveVector.U8))
        ]
      }
    });

    const result = await verifyPackage({
      packageName: "aptos_extensions",
      packageId: aptosExtensionsPackageId,
      namedDeps: [{ name: "deployer", address: deployerAddress }],
      rpcUrl: LOCAL_RPC_URL,
      sourceUploaded: false
    });

    assert.deepEqual(result, {
      packageName: "aptos_extensions",
      bytecodeVerified: false,
      metadataVerified: true
    });
  });

  it("Should report failure when package metadata does not match", async () => {
    const verifySource = true;
    await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "aptos_extensions",
      seed: Uint8Array.from(Buffer.from("aptos_extensions")),
      namedDeps: [{ name: "deployer", address: deployerAddress }],
      verifySource
    });

    const result = await verifyPackage({
      packageName: "aptos_extensions",
      packageId: aptosExtensionsPackageId,
      namedDeps: [{ name: "deployer", address: deployerAddress }],
      rpcUrl: LOCAL_RPC_URL,
      sourceUploaded: false
    });

    assert.deepEqual(result, {
      packageName: "aptos_extensions",
      bytecodeVerified: true,
      metadataVerified: false
    });
  });

  async function publishDefaultAptosExtensionsPkg() {
    await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "aptos_extensions",
      seed: Uint8Array.from(Buffer.from("aptos_extensions")),
      namedDeps: [{ name: "deployer", address: deployerAddress }],
      verifySource: false
    });
  }

  async function publishDefaultStablecoinPkg() {
    await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "stablecoin",
      seed: Uint8Array.from(Buffer.from("stablecoin")),
      namedDeps: [
        { name: "deployer", address: deployerAddress },
        { name: "aptos_extensions", address: aptosExtensionsPackageId }
      ],
      verifySource: false
    });
  }
});
