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

import { Account, AccountAddress } from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import sinon, { SinonStub } from "sinon";
import { configureController } from "../../scripts/typescript/configureController";
import * as stablecoinPackageModule from "../../scripts/typescript/packages/stablecoinPackage";
import { getAptosClient } from "../../scripts/typescript/utils";

describe("configureController", () => {
  let stablecoinPackageStub: SinonStub;

  beforeEach(() => {
    stablecoinPackageStub = sinon.stub(
      stablecoinPackageModule,
      "StablecoinPackage"
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call the configureController function with correct inputs", async () => {
    const masterMinter = Account.generate();
    const stablecoinPackageId = AccountAddress.ZERO.toString();
    const rpcUrl = "http://localhost:8080";
    const controller = AccountAddress.ONE.toString();
    const minter = AccountAddress.TWO.toString();

    const configureControllerFn = sinon.fake();
    stablecoinPackageStub.returns({
      treasury: {
        configureController: configureControllerFn
      }
    });

    await configureController({
      stablecoinPackageId,
      masterMinterKey: masterMinter.privateKey.toString(),
      controller,
      minter,
      rpcUrl
    });

    sinon.assert.calledWithNew(stablecoinPackageStub);
    sinon.assert.calledWithExactly(
      stablecoinPackageStub,
      getAptosClient(rpcUrl),
      stablecoinPackageId
    );

    assert.strictEqual(
      configureControllerFn.calledOnceWithExactly(
        masterMinter,
        controller,
        minter
      ),
      true
    );
  });
});
