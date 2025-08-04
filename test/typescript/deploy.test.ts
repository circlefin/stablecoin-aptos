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

import { createResourceAddress, Ed25519Account } from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import { deploy } from "../../scripts/typescript/deploy";
import { generateKeypair } from "../../scripts/typescript/generateKeypair";
import {
  getAptosClient,
  getPackageMetadata,
  LOCAL_FAUCET_URL,
  LOCAL_RPC_URL
} from "../../scripts/typescript/utils";
import { validateSourceCodeExistence } from "./testUtils";

describe("deploy E2E test", () => {
  const aptos = getAptosClient(LOCAL_RPC_URL);

  let deployer: Ed25519Account;

  beforeEach(async () => {
    deployer = await generateKeypair({
      rpcUrl: LOCAL_RPC_URL,
      faucetUrl: LOCAL_FAUCET_URL,
      prefund: true
    });
  });

  it("should successfully deploy a package with source code verification enabled", async () => {
    const seed = "my seed";

    await deploy("aptos_extensions", {
      rpcUrl: LOCAL_RPC_URL,
      deployerKey: deployer.privateKey.toString(),
      namedDeps: [
        { name: "deployer", address: deployer.accountAddress.toString() }
      ],
      seed,
      verifySource: true
    });

    // Package should be deployed to the correct address.
    const packageId = createResourceAddress(
      deployer.accountAddress,
      seed
    ).toString();

    const packageMetadata = await getPackageMetadata(
      aptos,
      packageId,
      "AptosExtensions"
    );
    assert(packageMetadata != null);

    // Source code should be uploaded.
    validateSourceCodeExistence(packageMetadata, true);
  });

  it("should successfully deploy a package with source code verification disabled", async () => {
    const seed = "my seed";

    await deploy("aptos_extensions", {
      rpcUrl: LOCAL_RPC_URL,
      deployerKey: deployer.privateKey.toString(),
      namedDeps: [
        { name: "deployer", address: deployer.accountAddress.toString() }
      ],
      seed,
      verifySource: false
    });

    // Package should be deployed to the correct address.
    const packageId = createResourceAddress(
      deployer.accountAddress,
      seed
    ).toString();

    const packageMetadata = await getPackageMetadata(
      aptos,
      packageId,
      "AptosExtensions"
    );
    assert(packageMetadata != null);

    // Source code should not be uploaded.
    validateSourceCodeExistence(packageMetadata, false);
  });
});
