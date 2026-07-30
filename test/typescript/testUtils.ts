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
import { Ed25519Account, MultiKey, MultiKeyAccount } from "@aptos-labs/ts-sdk";
import sinon from "sinon";
import { generateKeypair } from "../../scripts/typescript/generateKeypair";
import {
  checkSourceCodeExistence,
  PackageMetadata
} from "../../scripts/typescript/utils";

/**
 * Creates a Sinon matcher for Aptos client instances.
 * This matcher checks the client's configuration instead of doing a deep equality check,
 * which is necessary because the Aptos client object structure may vary between SDK versions.
 *
 * @param rpcUrl - The expected RPC URL (will be appended with /v1 for fullnode check)
 * @returns A Sinon matcher that can be used with sinon.assert.calledWithMatch
 *
 * @example
 * sinon.assert.calledWithMatch(
 *   stub,
 *   matchAptosClient("http://localhost:8080"),
 *   otherArgs...
 * );
 */
export function matchAptosClient(rpcUrl: string) {
  return sinon.match.has("config", sinon.match.has("fullnode", `${rpcUrl}/v1`));
}

export function validateSourceCodeExistence(
  pkgMetadata: PackageMetadata,
  sourceCodeExists: boolean
) {
  assert.strictEqual(checkSourceCodeExistence(pkgMetadata), sourceCodeExists);

  for (const module of pkgMetadata.modules) {
    // Source map is never included, when included_artifacts is set to "sparse" or "none"
    assert.strictEqual(module.source_map, "0x");
  }
}

type RepeatTuple<
  T,
  N extends number,
  A extends any[] = []
> = A["length"] extends N ? A : RepeatTuple<T, N, [...A, T]>;

export async function generateKeypairs<N extends number>(
  n: N,
  prefund: boolean
): Promise<RepeatTuple<Ed25519Account, N>> {
  const keypairs = await Promise.all(
    Array.from({ length: n }).map(() => generateKeypair({ prefund }))
  );
  return keypairs as RepeatTuple<Ed25519Account, N>;
}

export async function generateKOfNMultiKeyAccount(
  k: number,
  n: number
): Promise<MultiKeyAccount> {
  const keypairs = (await generateKeypairs(n, false)) as Array<Ed25519Account>;

  return new MultiKeyAccount({
    multiKey: new MultiKey({
      publicKeys: keypairs.map((keypair) => keypair.publicKey),
      signaturesRequired: k
    }),
    signers: keypairs.slice(0, k) // Only pass k signers, not all n
  });
}
