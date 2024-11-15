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

import { AccountAddress, AccountAddressInput, Aptos } from "@aptos-labs/ts-sdk";
import { callViewFunction, normalizeAddress } from "../utils";

export class AptosFrameworkPackage {
  readonly id: AccountAddressInput;
  readonly fungibleAsset: FungibleAsset;

  constructor(aptos: Aptos) {
    this.id = normalizeAddress("0x1");
    this.fungibleAsset = new FungibleAsset(aptos, `${this.id}::fungible_asset`);
  }
}

class FungibleAsset {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async supply(faAddress: AccountAddressInput): Promise<bigint> {
    const result = await callViewFunction<{ vec: [string] }>(
      this.aptos,
      `${this.moduleId}::supply`,
      [`${this.moduleId}::Metadata`],
      [AccountAddress.fromStrict(faAddress)]
    );

    if (!result.vec[0]) {
      throw new Error("Fungible Asset supply call failed!");
    }

    return BigInt(result.vec[0]);
  }

  async getDecimals(faAddress: AccountAddressInput): Promise<number> {
    return callViewFunction(
      this.aptos,
      `${this.moduleId}::decimals`,
      [`${this.moduleId}::Metadata`],
      [AccountAddress.fromStrict(faAddress)]
    );
  }
}
