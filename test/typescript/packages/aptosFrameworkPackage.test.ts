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

import { Aptos } from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import { AptosFrameworkPackage } from "../../../scripts/typescript/packages/aptosFrameworkPackage";
import {
  getAptosClient,
  normalizeAddress
} from "../../../scripts/typescript/utils";

describe("AptosFrameworkPackage", () => {
  const APT_FUNGIBLE_ASSET = normalizeAddress("0xA");

  let aptos: Aptos;
  let aptosFrameworkPackage: AptosFrameworkPackage;

  before(async () => {
    aptos = getAptosClient();
    aptosFrameworkPackage = new AptosFrameworkPackage(aptos);
  });

  describe("FungibleAsset", () => {
    describe("supply", () => {
      it("should return total supply when given a valid fungible asset", async () => {
        const supply =
          await aptosFrameworkPackage.fungibleAsset.supply(APT_FUNGIBLE_ASSET);
        assert(typeof supply === "bigint");
      });
    });

    describe("getDecimals", () => {
      it("should return correct decimals when given a valid fungible asset", async () => {
        assert.strictEqual(
          await aptosFrameworkPackage.fungibleAsset.getDecimals(
            APT_FUNGIBLE_ASSET
          ),
          8
        );
      });
    });
  });
});
