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
  HexInput,
  MoveVector,
  UserTransactionResponse
} from "@aptos-labs/ts-sdk";
import {
  callViewFunction,
  executeTransaction,
  normalizeAddress,
  validateAddresses
} from "../utils";

export class AptosExtensionsPackage {
  readonly id: AccountAddressInput;
  readonly upgradable: Upgradable;
  readonly manageable: Manageable;
  readonly ownable: Ownable;
  readonly pausable: Pausable;

  constructor(aptos: Aptos, aptosExtensionsPackageId: AccountAddressInput) {
    validateAddresses(aptosExtensionsPackageId);

    this.id = aptosExtensionsPackageId;
    this.upgradable = new Upgradable(
      aptos,
      `${aptosExtensionsPackageId}::upgradable`
    );
    this.manageable = new Manageable(
      aptos,
      `${aptosExtensionsPackageId}::manageable`
    );
    this.ownable = new Ownable(aptos, `${aptosExtensionsPackageId}::ownable`);
    this.pausable = new Pausable(
      aptos,
      `${aptosExtensionsPackageId}::pausable`
    );
  }
}

class Upgradable {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async upgradePackage(
    sender: Ed25519Account,
    packageId: AccountAddressInput,
    metadataBytes: HexInput,
    bytecode: HexInput[]
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::upgrade_package`,
        functionArguments: [
          AccountAddress.fromStrict(packageId),
          MoveVector.U8(metadataBytes),
          new MoveVector(bytecode.map(MoveVector.U8))
        ]
      }
    });
  }
}

class Manageable {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async admin(packageId: AccountAddressInput): Promise<string> {
    const result = await callViewFunction<string>(
      this.aptos,
      `${this.moduleId}::admin`,
      [],
      [AccountAddress.fromStrict(packageId)]
    );

    return normalizeAddress(result);
  }

  async pendingAdmin(packageId: AccountAddressInput): Promise<string | null> {
    const result = await callViewFunction<{ vec: [string] }>(
      this.aptos,
      `${this.moduleId}::pending_admin`,
      [],
      [AccountAddress.fromStrict(packageId)]
    );

    return result.vec[0] ? normalizeAddress(result.vec[0]) : null;
  }

  async changeAdmin(
    sender: Ed25519Account,
    packageId: AccountAddressInput,
    newAdmin: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::change_admin`,
        functionArguments: [
          AccountAddress.fromStrict(packageId),
          AccountAddress.fromStrict(newAdmin)
        ]
      }
    });
  }

  async acceptAdmin(
    sender: Ed25519Account,
    packageId: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::accept_admin`,
        functionArguments: [AccountAddress.fromStrict(packageId)]
      }
    });
  }
}

class Ownable {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async owner(objectId: AccountAddressInput): Promise<string> {
    const result = await callViewFunction<string>(
      this.aptos,
      `${this.moduleId}::owner`,
      [],
      [AccountAddress.fromStrict(objectId)]
    );

    return normalizeAddress(result);
  }

  async pendingOwner(objectId: AccountAddressInput): Promise<string | null> {
    const result = await callViewFunction<{ vec: [string] }>(
      this.aptos,
      `${this.moduleId}::pending_owner`,
      [],
      [AccountAddress.fromStrict(objectId)]
    );

    return result.vec[0] ? normalizeAddress(result.vec[0]) : null;
  }

  async transferOwnership(
    sender: Ed25519Account,
    objectId: AccountAddressInput,
    newAdmin: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::transfer_ownership`,
        functionArguments: [
          AccountAddress.fromStrict(objectId),
          AccountAddress.fromStrict(newAdmin)
        ]
      }
    });
  }

  async acceptOwnership(
    sender: Ed25519Account,
    objectId: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::accept_ownership`,
        functionArguments: [AccountAddress.fromStrict(objectId)]
      }
    });
  }
}

class Pausable {
  constructor(
    private readonly aptos: Aptos,
    private readonly moduleId: `${string}::${string}`
  ) {}

  async isPaused(objectId: AccountAddressInput): Promise<boolean> {
    const result = await callViewFunction<boolean>(
      this.aptos,
      `${this.moduleId}::is_paused`,
      [],
      [AccountAddress.fromStrict(objectId)]
    );

    return result;
  }

  async pauser(objectId: AccountAddressInput): Promise<string> {
    const result = await callViewFunction<string>(
      this.aptos,
      `${this.moduleId}::pauser`,
      [],
      [AccountAddress.fromStrict(objectId)]
    );

    return normalizeAddress(result);
  }

  async updatePauser(
    sender: Ed25519Account,
    objectId: AccountAddressInput,
    newPauser: AccountAddressInput
  ): Promise<UserTransactionResponse> {
    return executeTransaction({
      aptos: this.aptos,
      sender,
      data: {
        function: `${this.moduleId}::update_pauser`,
        functionArguments: [
          AccountAddress.fromStrict(objectId),
          AccountAddress.fromStrict(newPauser)
        ]
      }
    });
  }
}
