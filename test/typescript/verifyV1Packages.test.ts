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
import sinon from "sinon";
import { verifyV1Packages } from "../../scripts/typescript/verifyV1Packages";
import { calculateDeploymentAddresses } from "../../scripts/typescript/calculateDeploymentAddresses";
import * as verifyPackageModule from "../../scripts/typescript/verifyPackage";
import { Account } from "@aptos-labs/ts-sdk";

describe("Verify V1 packages", () => {
  let deployerAddress: string;
  let aptosExtensionsPackageId: string;
  let stablecoinPackageId: string;

  beforeEach(async () => {
    deployerAddress = Account.generate().accountAddress.toString();
    ({ aptosExtensionsPackageId, stablecoinPackageId } =
      calculateDeploymentAddresses({
        deployer: deployerAddress,
        aptosExtensionsSeed: "package_name",
        stablecoinSeed: "stablecoin"
      }));
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call the verifyPackage function with correct inputs", async () => {
    const rpcUrl = "http://localhost:8080";
    const sourceUploaded = false;

    const stubbedResult = {
      packageName: "package_name",
      bytecodeVerified: true,
      metadataVerified: true
    };
    const verifyPackageStub = sinon
      .stub(verifyPackageModule, "verifyPackage")
      .resolves(stubbedResult);

    const results = await verifyV1Packages({
      deployer: deployerAddress,
      aptosExtensionsPackageId,
      stablecoinPackageId,
      rpcUrl,
      sourceUploaded
    });

    sinon.assert.calledTwice(verifyPackageStub);
    sinon.assert.calledWithExactly(verifyPackageStub, {
      packageName: "aptos_extensions",
      packageId: aptosExtensionsPackageId,
      namedDeps: [
        {
          name: "deployer",
          address: deployerAddress
        }
      ],
      rpcUrl,
      sourceUploaded
    });
    sinon.assert.calledWithExactly(verifyPackageStub, {
      packageName: "stablecoin",
      packageId: stablecoinPackageId,
      namedDeps: [
        {
          name: "deployer",
          address: deployerAddress
        },
        {
          name: "aptos_extensions",
          address: aptosExtensionsPackageId
        }
      ],
      rpcUrl,
      sourceUploaded
    });

    assert.deepEqual(results, [stubbedResult, stubbedResult]);
  });
});
