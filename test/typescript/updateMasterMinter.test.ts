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
import { updateMasterMinter } from "../../scripts/typescript/updateMasterMinter";
import * as stablecoinPackageModule from "../../scripts/typescript/packages/stablecoinPackage";
import { getAptosClient } from "../../scripts/typescript/utils";

describe("updateMasterMinter", () => {
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

  it("should call the updateMasterMinter function with correct inputs", async () => {
    const stablecoinPackageId = AccountAddress.ZERO.toString();
    const owner = Account.generate();
    const masterMinter = AccountAddress.ONE.toString();
    const newMasterMinter = AccountAddress.TWO.toString();
    const rpcUrl = "http://localhost:8080";

    const updateMasterMinterFn = sinon.fake();
    stablecoinPackageStub.returns({
      treasury: {
        masterMinter: sinon.fake.returns(masterMinter),
        updateMasterMinter: updateMasterMinterFn
      }
    });

    await updateMasterMinter({
      stablecoinPackageId,
      ownerKey: owner.privateKey.toString(),
      newMasterMinter,
      rpcUrl
    });

    // Ensure that the request will be made to the correct package.
    sinon.assert.calledWithNew(stablecoinPackageStub);
    sinon.assert.calledWithExactly(
      stablecoinPackageStub,
      getAptosClient(rpcUrl),
      stablecoinPackageId
    );

    // Ensure that the request is correct.
    assert.strictEqual(
      updateMasterMinterFn.calledOnceWithExactly(owner, newMasterMinter),
      true
    );
  });
});
