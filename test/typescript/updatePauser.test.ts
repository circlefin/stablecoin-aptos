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
import { updatePauser } from "../../scripts/typescript/updatePauser";
import * as aptosExtensionsPackageModule from "../../scripts/typescript/packages/aptosExtensionsPackage";
import * as stablecoinPackageModule from "../../scripts/typescript/packages/stablecoinPackage";
import { getAptosClient } from "../../scripts/typescript/utils";

describe("updatePauser", () => {
  let aptosExtensionsPackageStub: SinonStub;
  let stablecoinPackageStub: SinonStub;

  beforeEach(() => {
    aptosExtensionsPackageStub = sinon.stub(
      aptosExtensionsPackageModule,
      "AptosExtensionsPackage"
    );
    stablecoinPackageStub = sinon.stub(
      stablecoinPackageModule,
      "StablecoinPackage"
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call the updatePauser function with correct inputs", async () => {
    const aptosExtensionsPackageId = AccountAddress.ZERO.toString();
    const stablecoinPackageId = AccountAddress.ONE.toString();
    const stablecoinAddress = AccountAddress.TWO.toString();
    const owner = Account.generate();
    const pauser = AccountAddress.THREE.toString();
    const newPauser = AccountAddress.FOUR.toString();
    const rpcUrl = "http://localhost:8080";

    const updatePauserFn = sinon.fake();
    aptosExtensionsPackageStub.returns({
      pausable: {
        pauser: sinon.fake.returns(pauser),
        updatePauser: updatePauserFn
      }
    });

    stablecoinPackageStub.returns({
      stablecoin: {
        stablecoinAddress: sinon.fake.returns(stablecoinAddress)
      }
    });

    await updatePauser({
      aptosExtensionsPackageId,
      stablecoinPackageId,
      ownerKey: owner.privateKey.toString(),
      newPauser,
      rpcUrl
    });

    // Ensure that the request will be made to the correct package.
    sinon.assert.calledWithNew(aptosExtensionsPackageStub);
    sinon.assert.calledWithExactly(
      aptosExtensionsPackageStub,
      getAptosClient(rpcUrl),
      aptosExtensionsPackageId
    );

    // Ensure that the request is correct.
    assert.strictEqual(
      updatePauserFn.calledOnceWithExactly(owner, stablecoinAddress, newPauser),
      true
    );
  });
});
