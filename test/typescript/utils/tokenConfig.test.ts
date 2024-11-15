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
import fs from "fs";
import sinon, { SinonStub } from "sinon";
import {
  readTokenConfig,
  TokenConfig
} from "../../../scripts/typescript/utils/tokenConfig";

describe("tokenConfig", () => {
  let existsSyncStub: SinonStub;
  let readFileSyncStub: SinonStub;
  let validTokenConfig: TokenConfig;

  beforeEach(() => {
    existsSyncStub = sinon.stub(fs, "existsSync");
    readFileSyncStub = sinon.stub(fs, "readFileSync");

    validTokenConfig = {
      name: "name",
      symbol: "symbol",
      decimals: 6,
      iconUri: "http://icon_uri.com",
      projectUri: "http://project_uri.com",

      admin: AccountAddress.ZERO.toString(),
      blocklister: AccountAddress.ONE.toString(),
      masterMinter: AccountAddress.TWO.toString(),
      metadataUpdater: AccountAddress.THREE.toString(),
      owner: AccountAddress.FOUR.toString(),
      pauser: AccountAddress.from("0x05").toString(),
      controllers: {
        [AccountAddress.from("0x06").toString()]:
          AccountAddress.from("0x07").toString()
      },
      minters: {
        [AccountAddress.from("0x07").toString()]: "100000"
      }
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  const randomAddress = (): string =>
    Account.generate().accountAddress.toString();

  it("should succeed", () => {
    existsSyncStub.returns(true);
    readFileSyncStub.returns(JSON.stringify(validTokenConfig));

    readTokenConfig("tokenConfigPath");
  });

  it("should fail if config file does not exist", () => {
    existsSyncStub.returns(false);

    assert.throws(
      () => readTokenConfig("tokenConfigPath"),
      /Failed to load config file.*/
    );
  });

  it("should fail if config file format is incorrect", () => {
    existsSyncStub.returns(true);
    readFileSyncStub.returns(JSON.stringify({}));

    assert.throws(
      () => readTokenConfig("tokenConfigPath"),
      /ValidationError:.*/
    );
  });

  it("should fail if there are no controllers controlling a minter", () => {
    validTokenConfig.minters[randomAddress()] = "200000";

    existsSyncStub.returns(true);
    readFileSyncStub.returns(JSON.stringify(validTokenConfig));

    assert.throws(
      () => readTokenConfig("tokenConfigPath"),
      /The set of minters in tokenConfig.controllers does not match the set of minters in tokenConfig.minters!/
    );
  });

  it("should fail if there are no mint allowance for defined for a minter", () => {
    validTokenConfig.controllers[randomAddress()] = randomAddress();

    existsSyncStub.returns(true);
    readFileSyncStub.returns(JSON.stringify(validTokenConfig));

    assert.throws(
      () => readTokenConfig("tokenConfigPath"),
      /The set of minters in tokenConfig.controllers does not match the set of minters in tokenConfig.minters!/
    );
  });

  it("should fail if mint allowance is larger than MAX_U64", () => {
    const minter = randomAddress();
    validTokenConfig.controllers[randomAddress()] = minter;
    validTokenConfig.minters[minter] = (BigInt(2) ** BigInt(64)).toString();

    existsSyncStub.returns(true);
    readFileSyncStub.returns(JSON.stringify(validTokenConfig));

    assert.throws(
      () => readTokenConfig("tokenConfigPath"),
      /There are mint allowances that exceed MAX_U64!/
    );
  });
});
