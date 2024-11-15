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

import fs from "fs";
import * as yup from "yup";
import {
  areSetsEqual,
  isAptosAddress,
  isBigIntable,
  MAX_U64,
  yupAptosAddress
} from ".";

export type TokenConfig = yup.InferType<typeof tokenConfigSchema>;

const tokenConfigSchema = yup.object().shape({
  name: yup.string().required(),
  symbol: yup.string().required(),
  decimals: yup.number().required(),
  iconUri: yup.string().url().required(),
  projectUri: yup.string().url().required(),

  admin: yupAptosAddress().required(),
  blocklister: yupAptosAddress().required(),
  masterMinter: yupAptosAddress().required(),
  metadataUpdater: yupAptosAddress().required(),
  owner: yupAptosAddress().required(),
  pauser: yupAptosAddress().required(),
  controllers: yup
    .mixed(
      (input): input is Record<string, string> =>
        typeof input === "object" &&
        Object.keys(input).every(isAptosAddress) &&
        Object.values(input).every(isAptosAddress)
    )
    .required(),
  minters: yup
    .mixed(
      (input): input is Record<string, string> =>
        typeof input === "object" &&
        Object.keys(input).every(isAptosAddress) &&
        Object.values(input).every(isBigIntable)
    )
    .required()
});

/**
 * Reads and validates the token configuration file.
 * @param tokenConfigPath Path to a valid token configuration file.
 * @returns The parsed and validated token configuration.
 */
export function readTokenConfig(tokenConfigPath: string): TokenConfig {
  if (!fs.existsSync(tokenConfigPath)) {
    throw new Error(`Failed to load config file: ${tokenConfigPath}`);
  }

  // Validate that the token configuration JSON follows the expected schema.
  const tokenConfig = tokenConfigSchema.validateSync(
    JSON.parse(fs.readFileSync(tokenConfigPath, "utf8")),
    { abortEarly: false, strict: true }
  );

  // Additional data validation.
  if (
    !areSetsEqual(
      new Set(Object.values(tokenConfig.controllers)),
      new Set(Object.keys(tokenConfig.minters))
    )
  ) {
    throw new Error(
      "The set of minters in tokenConfig.controllers does not match the set of minters in tokenConfig.minters!"
    );
  }

  if (
    Object.values(tokenConfig.minters).some(
      (mintAllowance) => BigInt(mintAllowance) > MAX_U64
    )
  ) {
    throw new Error("There are mint allowances that exceed MAX_U64!");
  }
  return tokenConfig;
}
