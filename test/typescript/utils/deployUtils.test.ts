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
  Aptos,
  createResourceAddress,
  Ed25519Account
} from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import { randomBytes } from "crypto";
import { generateKeypair } from "../../../scripts/typescript/generateKeypair";
import {
  getAptosClient,
  getPackageMetadata
} from "../../../scripts/typescript/utils";
import { publishPackageToResourceAccount } from "../../../scripts/typescript/utils/deployUtils";
import { validateSourceCodeExistence } from "../testUtils";

describe("Deploy utils", () => {
  let aptos: Aptos;
  let aptosExtensionsPackageId: string;
  let deployer: Ed25519Account;

  before(async () => {
    aptos = getAptosClient();
    deployer = await generateKeypair({ prefund: true });
    [aptosExtensionsPackageId] = await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "aptos_extensions",
      seed: new Uint8Array(Buffer.from("aptos_extensions")),
      namedDeps: [
        { name: "deployer", address: deployer.accountAddress.toString() }
      ],
      verifySource: false
    });
  });

  it("should succeed when publishing aptos_extensions package via resource account", async () => {
    const seed = new Uint8Array(randomBytes(16));
    const verifySource = false;

    const [packageId, txOutput] = await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "aptos_extensions",
      seed,
      namedDeps: [
        { name: "deployer", address: deployer.accountAddress.toString() }
      ],
      verifySource
    });
    const expectedCodeAddress = createResourceAddress(
      deployer.accountAddress,
      seed
    ).toString();

    assert.strictEqual(txOutput.events.length, 2); // PublishPackage and FeeStatement
    assert.strictEqual(packageId, expectedCodeAddress);

    const packageMetadata = await getPackageMetadata(
      aptos,
      packageId,
      "AptosExtensions"
    );
    validateSourceCodeExistence(packageMetadata, verifySource);
  });

  it("should succeed when publishing stablecoin package via resource account", async () => {
    const seed = new Uint8Array(randomBytes(16));
    const verifySource = false;

    const [packageId, txOutput] = await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "stablecoin",
      seed,
      namedDeps: [
        { name: "aptos_extensions", address: aptosExtensionsPackageId },
        { name: "deployer", address: deployer.accountAddress.toString() }
      ],
      verifySource
    });
    const expectedCodeAddress = createResourceAddress(
      deployer.accountAddress,
      seed
    ).toString();

    assert.strictEqual(txOutput.events.length, 2); // PublishPackage and FeeStatement
    assert.strictEqual(packageId, expectedCodeAddress);

    const packageMetadata = await getPackageMetadata(
      aptos,
      packageId,
      "Stablecoin"
    );
    validateSourceCodeExistence(packageMetadata, verifySource);
  });

  it("should succeed when publishing package with source code verification enabled", async () => {
    const seed = new Uint8Array(randomBytes(16));
    const verifySource = true;

    const [packageId] = await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "aptos_extensions",
      seed,
      namedDeps: [
        { name: "deployer", address: deployer.accountAddress.toString() }
      ],
      verifySource
    });

    const packageMetadata = await getPackageMetadata(
      aptos,
      packageId,
      "AptosExtensions"
    );
    validateSourceCodeExistence(packageMetadata, verifySource);
  });
});
