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
  Aptos,
  createResourceAddress,
  Ed25519Account,
  MoveVector,
  UserTransactionResponse
} from "@aptos-labs/ts-sdk";
import { execSync } from "node:child_process";
import fs from "fs";
import path from "path";

import {
  executeTransaction,
  getEventByType,
  normalizeAddress,
  REPOSITORY_ROOT,
  validateAddresses
} from ".";
import { readPublishPayload } from "./publishPayload";

export type NamedAddress = { name: string; address: string };

/**
 * Publishes a package to a newly created resource account
 * @returns The address of the published package
 * @throws if the transaction fails
 */
export async function publishPackageToResourceAccount({
  aptos,
  deployer,
  packageName,
  seed,
  namedDeps,
  verifySource
}: {
  aptos: Aptos;
  deployer: Ed25519Account;
  packageName: string;
  namedDeps: NamedAddress[];
  seed: Uint8Array;
  verifySource: boolean;
}): Promise<[string, UserTransactionResponse]> {
  const expectedCodeAddress = createResourceAddress(
    deployer.accountAddress,
    seed
  ).toString();

  const { metadataBytes, bytecode } = await buildPackage(
    packageName,
    [
      {
        name: packageName,
        address: expectedCodeAddress
      },
      ...namedDeps
    ],
    verifySource
  );
  const functionArguments = [
    MoveVector.U8(seed),
    MoveVector.U8(metadataBytes),
    new MoveVector(bytecode.map(MoveVector.U8))
  ];

  const txOutput = await executeTransaction({
    aptos,
    sender: deployer,
    data: {
      function:
        "0x1::resource_account::create_resource_account_and_publish_package",
      functionArguments
    }
  });

  const rawCodeAddress = getEventByType(txOutput, "0x1::code::PublishPackage")
    .data.code_address;
  const packageId = normalizeAddress(rawCodeAddress);

  if (packageId !== expectedCodeAddress) {
    throw new Error(
      `Package was published to an unexpected address! Expected: ${expectedCodeAddress}, but published to ${packageId}`
    );
  }

  return [packageId, txOutput];
}

/**
 * Builds a package with the given package name and named addresses
 * @returns The metadata bytes and bytecode of the package
 */
export async function buildPackage(
  packageName: string,
  namedAddresses: NamedAddress[],
  verifySource: boolean
): Promise<{
  metadataBytes: string;
  bytecode: string[];
}> {
  const payloadFilePath = await buildPackagePublishPayloadFile(
    packageName,
    namedAddresses,
    verifySource
  );
  const publishPayload = readPublishPayload(payloadFilePath);
  fs.unlinkSync(payloadFilePath); // delete saved json at PAYLOAD_FILE_PATH

  return {
    metadataBytes: publishPayload.args[0].value,
    bytecode: publishPayload.args[1].value
  };
}

export async function buildPackagePublishPayloadFile(
  packageName: string,
  namedAddresses: NamedAddress[],
  verifySource: boolean
): Promise<string> {
  const payloadFilePath = path.join(
    REPOSITORY_ROOT,
    "scripts",
    "typescript",
    "build-output",
    `${packageName}-${Date.now()}.json`
  );

  const buildCommand = `make build-publish-payload \
    package="${packageName}" \
    output="${payloadFilePath}" \
    named_addresses="${formatNamedAddresses(namedAddresses)}" \
    included_artifacts="${getIncludedArtifactsSetting(verifySource)}"`;
  const result = execSync(buildCommand, { encoding: "utf-8" });

  if (!fs.existsSync(payloadFilePath)) {
    console.error(result);
    throw new Error(`Build failed with the following command: ${buildCommand}`);
  }
  return payloadFilePath;
}

/**
 * Parses a string of named addresses in the format "name1=address1,name2=address2"
 */
export function parseNamedAddresses(namedAddressArg: string): NamedAddress[] {
  return namedAddressArg.split(",").map((arg) => {
    const [name, address] = arg.split("=");
    validateAddresses(address);
    return { name, address };
  });
}

/**
 * Formats a list of named addresses into a string of the format "name1=address1,name2=address2"
 */
export function formatNamedAddresses(namedAddresses: NamedAddress[]): string {
  return namedAddresses
    .map(({ name, address }) => `${name}=${address}`)
    .join(",");
}

/**
 * Returns the setting for the included artifacts flag
 */
export function getIncludedArtifactsSetting(sourceUploaded?: boolean): string {
  return sourceUploaded ? "sparse" : "none";
}
