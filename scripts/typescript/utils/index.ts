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

import {
  AptosConfig,
  Aptos,
  Ed25519Account,
  EntryFunctionArgumentTypes,
  Event,
  InputGenerateTransactionPayloadData,
  MoveFunctionId,
  Network,
  TypeArgument,
  UserTransactionResponse,
  AccountAddress,
  AccountAddressInput,
  MoveModuleBytecode
} from "@aptos-labs/ts-sdk";
import assert from "assert";
import path from "path";
import readline from "readline/promises";
import * as yup from "yup";

export const MAX_U64 = BigInt("0xFFFFFFFFFFFFFFFF");
export const REPOSITORY_ROOT = path.resolve(
  path.join(__dirname, "..", "..", "..")
);
export const LOCAL_RPC_URL = "http://localhost:8080";
export const LOCAL_FAUCET_URL = "http://localhost:8081";

export type PackageMetadata = {
  name: string;
  upgrade_policy: any;
  upgrade_number: number;
  source_digest: string;
  manifest: number[];
  modules: { source: string; source_map: string }[];
  deps: unknown[];
  extension: { vec: [unknown] };
};

export function getAptosClient(url?: string, faucetUrl?: string): Aptos {
  return new Aptos(
    new AptosConfig({
      network: Network.CUSTOM,
      fullnode: `${url ?? LOCAL_RPC_URL}/v1`,
      faucet: faucetUrl ?? LOCAL_FAUCET_URL
    })
  );
}

/**
 * Calls a view function in Move and returns the first result.
 */
export async function callViewFunction<T>(
  aptos: Aptos,
  functionId: MoveFunctionId,
  typeArguments: TypeArgument[],
  functionArgs: EntryFunctionArgumentTypes[]
): Promise<T> {
  const data = await aptos.view<[T]>({
    payload: {
      function: functionId,
      typeArguments,
      functionArguments: functionArgs
    }
  });
  return data[0];
}

/**
 * Executes a transaction and waits for it to be included in a block
 * @returns the transaction output
 * @throws if the transaction fails
 */
export async function executeTransaction({
  aptos,
  sender,
  data
}: {
  aptos: Aptos;
  sender: Ed25519Account;
  data: InputGenerateTransactionPayloadData;
}): Promise<UserTransactionResponse> {
  const transaction = await aptos.transaction.build.simple({
    sender: sender.accountAddress,
    data
  });
  const response = await aptos.signAndSubmitTransaction({
    signer: sender,
    transaction
  });
  const txOutput = await aptos.waitForTransaction({
    transactionHash: response.hash
  });
  if (!txOutput.success) {
    console.error(txOutput);
    throw new Error("Unexpected transaction failure");
  }
  return txOutput as UserTransactionResponse;
}

/**
 * Finds a specific event from the transaction output
 */
export function getEventByType(
  txOutput: UserTransactionResponse,
  eventType: string
): Event {
  const event = txOutput.events.find((e: any) => e.type === eventType);
  assert(!!event, `Event ${eventType} not found`);
  return event;
}

/**
 * Reformat address to ensure it conforms to AIP-40.
 */
export function normalizeAddress(address: string): string {
  return AccountAddress.from(address).toString();
}

/**
 * Throws if any address does not match the format defined in AIP-40.
 */
export function validateAddresses(...addresses: AccountAddressInput[]) {
  for (const address of addresses) {
    const result = AccountAddress.isValid({ input: address, strict: true });
    if (!result.valid) {
      throw new Error(result.invalidReasonMessage);
    }
  }
}

/**
 * Prompts the user to confirm an action
 */
export async function waitForUserConfirmation() {
  if (process.env.NODE_ENV === "TESTING") {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let userResponse: boolean;

  while (true) {
    const response = (await rl.question("Are you sure? (Y/N): ")).toUpperCase();
    if (response != "Y" && response != "N") {
      continue;
    }
    userResponse = response === "Y";
    break;
  }
  rl.close();

  return userResponse;
}

/**
 * Fetches the bytecode of a package
 * Works for packages that have up to 25 modules
 * @returns string[] of bytecode
 */
export async function getPackageBytecode(
  aptos: Aptos,
  packageId: string
): Promise<string[]> {
  const rawRemoteModuleBytecode: MoveModuleBytecode[] =
    await aptos.getAccountModules({
      accountAddress: packageId,
      options: { limit: 25 }
    });
  return rawRemoteModuleBytecode.map((module) => module.bytecode);
}

/**
 * Yup utilities
 */

export function yupAptosAddress() {
  return yup.string().test(isAptosAddress);
}

export function isAptosAddress(value: any) {
  return (
    typeof value === "string" &&
    AccountAddress.isValid({ input: value, strict: true }).valid
  );
}

export function isBigIntable(value: any) {
  try {
    BigInt(value);
  } catch (e) {
    return false;
  }
  return true;
}

export function areSetsEqual<T>(self: Set<T>, other: Set<T>): boolean {
  for (const elem of self) {
    if (!other.has(elem)) return false;
  }
  for (const elem of other) {
    if (!self.has(elem)) return false;
  }
  return true;
}

export async function getPackageMetadata(
  aptos: Aptos,
  packageId: string,
  packageName: string
): Promise<PackageMetadata> {
  return (
    await aptos.getAccountResource({
      accountAddress: packageId,
      resourceType: "0x1::code::PackageRegistry"
    })
  ).packages.find((p: PackageMetadata) => p.name == packageName);
}

export function checkSourceCodeExistence(
  pkgMetadata: PackageMetadata
): boolean {
  if (pkgMetadata.modules.every((m) => m.source !== "0x")) {
    return true;
  } else if (pkgMetadata.modules.every((m) => m.source === "0x")) {
    return false;
  } else {
    throw new Error(
      "Only some modules have their source code uploaded. Ensure that either all source code are uploaded, or none is uploaded."
    );
  }
}
