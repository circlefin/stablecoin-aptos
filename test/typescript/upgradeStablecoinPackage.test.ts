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
import * as aptosExtensionsPackageModule from "../../scripts/typescript/packages/aptosExtensionsPackage";
import { upgradeStablecoinPackage } from "../../scripts/typescript/upgradeStablecoinPackage";
import * as publishPayloadModule from "../../scripts/typescript/utils/publishPayload";
import { getAptosClient } from "../../scripts/typescript/utils";

describe("Upgrade package", () => {
  let aptosExtensionsPackageStub: SinonStub;
  let readPublishPayloadStub: SinonStub;

  beforeEach(() => {
    aptosExtensionsPackageStub = sinon.stub(
      aptosExtensionsPackageModule,
      "AptosExtensionsPackage"
    );

    readPublishPayloadStub = sinon.stub(
      publishPayloadModule,
      "readPublishPayload"
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call the upgradePackage function with correct inputs", async () => {
    const deployer = Account.generate();
    const rpcUrl = "http://localhost:8080";
    const stablecoinPackageId = AccountAddress.ZERO.toString();
    const aptosExtensionsPackageId = AccountAddress.ONE.toString();
    const metadataBytes = "0x10";
    const bytecode = ["0x11", "0x12"];

    const upgradePackageFn = sinon.fake();
    aptosExtensionsPackageStub.returns({
      upgradable: {
        upgradePackage: upgradePackageFn
      }
    });

    readPublishPayloadStub.returns({
      args: [
        { type: "hex", value: metadataBytes },
        { type: "hex", value: bytecode }
      ]
    });

    await upgradeStablecoinPackage({
      adminKey: deployer.privateKey.toString(),
      rpcUrl,
      payloadFilePath: "payloadFilePath",
      stablecoinPackageId,
      aptosExtensionsPackageId
    });

    sinon.assert.calledWithNew(aptosExtensionsPackageStub);
    sinon.assert.calledWithExactly(
      aptosExtensionsPackageStub,
      getAptosClient(rpcUrl),
      aptosExtensionsPackageId
    );

    assert.strictEqual(
      upgradePackageFn.calledOnceWithExactly(
        deployer,
        stablecoinPackageId,
        metadataBytes,
        bytecode
      ),
      true
    );
  });
});
