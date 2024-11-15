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
  AccountAddress,
  AccountAddressInput,
  Aptos,
  Ed25519Account,
  MoveString,
  U64,
  U8,
  UserTransactionResponse
} from "@aptos-labs/ts-sdk";
import {
  callViewFunction,
  executeTransaction,
  normalizeAddress,
  validateAddresses
} from "../utils";

export class StablecoinPackage {
  readonly id: AccountAddressInput;
  readonly stablecoin: Stablecoin;
  readonly treasury: Treasury;
  readonly blocklistable: Blocklistable;
  readonly metadata: Metadata;

  constructor(aptos: Aptos, stablecoinPackageId: AccountAddressInput) {
    validateAddresses(stablecoinPackageId);

    this.id = stablecoinPackageId;
    this.stablecoin = new Stablecoin(
      aptos,
      `${stablecoinPackageId}::stablecoin`
    );
    this.treasury = new Treasury(aptos, `${stablecoinPackageId}::treasury`);
    this.blocklistable = new Blocklistable(
      aptos,
      `${stablecoinPackageId}::blocklistable`
    );
    this.metadata = new Metadata(aptos, `${stablecoinPackageId}::metadata`);
  }
}

class Stablecoin {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async stablecoinAddress(): Promise<string> {
    const result = await callViewFunction<string>(
      this.aptos,
      `${this.moduleId}::stablecoin_address`,
      [],
      []
    );
    return normalizeAddress(result);
  }

  async initializeV1(
    sender: Ed25519Account,
    name: string,
    symbol: string,
    decimals: number,
    iconUri: string,
    projectUri: string
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::initialize_v1`,
        functionArguments: [
          new MoveString(name),
          new MoveString(symbol),
          new U8(decimals),
          new MoveString(iconUri),
          new MoveString(projectUri)
        ]
      }
    });
  }
}

class Treasury {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async masterMinter(): Promise<string> {
    const result = await callViewFunction<string>(
      this.aptos,
      `${this.moduleId}::master_minter`,
      [],
      []
    );

    return normalizeAddress(result);
  }

  async getMinter(controller: AccountAddressInput): Promise<string | null> {
    const result = await callViewFunction<{ vec: [string] }>(
      this.aptos,
      `${this.moduleId}::get_minter`,
      [],
      [AccountAddress.fromStrict(controller)]
    );

    return result.vec[0] ? normalizeAddress(result.vec[0]) : null;
  }

  async isMinter(minter: AccountAddressInput): Promise<boolean> {
    const result = await callViewFunction<boolean>(
      this.aptos,
      `${this.moduleId}::is_minter`,
      [],
      [AccountAddress.fromStrict(minter)]
    );

    return result;
  }

  async mintAllowance(minter: AccountAddressInput): Promise<bigint> {
    const result = await callViewFunction<number>(
      this.aptos,
      `${this.moduleId}::mint_allowance`,
      [],
      [AccountAddress.fromStrict(minter)]
    );

    return BigInt(result);
  }

  async configureController(
    sender: Ed25519Account,
    controller: AccountAddressInput,
    minter: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::configure_controller`,
        functionArguments: [
          AccountAddress.fromStrict(controller),
          AccountAddress.fromStrict(minter)
        ]
      }
    });
  }

  async configureMinter(
    sender: Ed25519Account,
    mintAllowance: bigint
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::configure_minter`,
        functionArguments: [new U64(mintAllowance)]
      }
    });
  }

  async removeController(
    sender: Ed25519Account,
    controller: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::remove_controller`,
        functionArguments: [AccountAddress.fromStrict(controller)]
      }
    });
  }

  async removeMinter(sender: Ed25519Account): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::remove_minter`,
        functionArguments: []
      }
    });
  }

  async updateMasterMinter(
    sender: Ed25519Account,
    newMasterMinter: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::update_master_minter`,
        functionArguments: [AccountAddress.fromStrict(newMasterMinter)]
      }
    });
  }
}

class Blocklistable {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async blocklister(): Promise<string> {
    const result = await callViewFunction<string>(
      this.aptos,
      `${this.moduleId}::blocklister`,
      [],
      []
    );

    return normalizeAddress(result);
  }

  async isBlocklisted(address: AccountAddressInput): Promise<boolean> {
    const result = await callViewFunction<boolean>(
      this.aptos,
      `${this.moduleId}::is_blocklisted`,
      [],
      [AccountAddress.fromStrict(address)]
    );

    return result;
  }

  async updateBlocklister(
    sender: Ed25519Account,
    newBlocklister: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::update_blocklister`,
        functionArguments: [AccountAddress.fromStrict(newBlocklister)]
      }
    });
  }

  async blocklist(
    sender: Ed25519Account,
    address: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::blocklist`,
        functionArguments: [AccountAddress.fromStrict(address)]
      }
    });
  }

  async unblocklist(
    sender: Ed25519Account,
    address: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::unblocklist`,
        functionArguments: [AccountAddress.fromStrict(address)]
      }
    });
  }
}

class Metadata {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async metadataUpdater(): Promise<string> {
    const result = await callViewFunction<string>(
      this.aptos,
      `${this.moduleId}::metadata_updater`,
      [],
      []
    );

    return normalizeAddress(result);
  }

  async updateMetadataUpdater(
    sender: Ed25519Account,
    newMetadataUpdater: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::update_metadata_updater`,
        functionArguments: [AccountAddress.fromStrict(newMetadataUpdater)]
      }
    });
  }
}
