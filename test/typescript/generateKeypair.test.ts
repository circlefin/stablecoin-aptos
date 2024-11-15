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
import { generateKeypair } from "../../scripts/typescript/generateKeypair";
import {
  getAptosClient,
  LOCAL_FAUCET_URL,
  LOCAL_RPC_URL
} from "../../scripts/typescript/utils";

describe("generateKeypair", () => {
  const aptos = getAptosClient(LOCAL_RPC_URL, LOCAL_FAUCET_URL);

  it("should create an unfunded keypair", async () => {
    const keypair = await generateKeypair({
      rpcUrl: LOCAL_RPC_URL,
      faucetUrl: LOCAL_FAUCET_URL,
      prefund: false
    });

    assert.strictEqual(
      await aptos.getAccountAPTAmount({
        accountAddress: keypair.accountAddress
      }),
      0
    );
  });

  it("should create a keypair and prefund it with 10 APT", async () => {
    const keypair = await generateKeypair({
      rpcUrl: LOCAL_RPC_URL,
      faucetUrl: LOCAL_FAUCET_URL,
      prefund: true
    });

    assert.strictEqual(
      await aptos.getAccountAPTAmount({
        accountAddress: keypair.accountAddress
      }),
      1_000_000_000
    );
  });
});
