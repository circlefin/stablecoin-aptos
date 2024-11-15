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
import { configureMinter } from "../../scripts/typescript/configureMinter";
import * as aptosFrameworkPackageModule from "../../scripts/typescript/packages/aptosFrameworkPackage";
import * as stablecoinPackageModule from "../../scripts/typescript/packages/stablecoinPackage";
import { getAptosClient } from "../../scripts/typescript/utils";

describe("configureMinter", () => {
  let aptosFrameworkPackageStub: SinonStub;
  let stablecoinPackageStub: SinonStub;

  beforeEach(() => {
    aptosFrameworkPackageStub = sinon.stub(
      aptosFrameworkPackageModule,
      "AptosFrameworkPackage"
    );
    stablecoinPackageStub = sinon.stub(
      stablecoinPackageModule,
      "StablecoinPackage"
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call the configureMinter function with correct inputs", async () => {
    const controller = Account.generate();
    const stablecoinPackageId = AccountAddress.ZERO.toString();
    const rpcUrl = "http://localhost:8080";
    const mintAllowance = "1000000000";

    aptosFrameworkPackageStub.returns({
      fungibleAsset: {
        getDecimals: sinon.fake.returns(6)
      }
    });

    const configureMinterFn = sinon.fake();
    stablecoinPackageStub.returns({
      stablecoin: {
        stablecoinAddress: sinon.fake.returns(AccountAddress.ONE.toString())
      },
      treasury: {
        configureMinter: configureMinterFn,
        getMinter: sinon.fake.returns(AccountAddress.TWO.toString())
      }
    });

    await configureMinter({
      stablecoinPackageId,
      controllerKey: controller.privateKey.toString(),
      mintAllowance,
      rpcUrl
    });

    sinon.assert.calledWithNew(stablecoinPackageStub);
    sinon.assert.calledWithExactly(
      stablecoinPackageStub,
      getAptosClient(rpcUrl),
      stablecoinPackageId
    );

    assert.strictEqual(
      configureMinterFn.calledOnceWithExactly(
        controller,
        BigInt(mintAllowance)
      ),
      true
    );
  });
});
