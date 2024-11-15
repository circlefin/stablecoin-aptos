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

import { Aptos, Ed25519Account } from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import { generateKeypair } from "../../../scripts/typescript/generateKeypair";
import { AptosExtensionsPackage } from "../../../scripts/typescript/packages/aptosExtensionsPackage";
import { getAptosClient } from "../../../scripts/typescript/utils";
import {
  buildPackage,
  publishPackageToResourceAccount
} from "../../../scripts/typescript/utils/deployUtils";
import { StablecoinPackage } from "../../../scripts/typescript/packages/stablecoinPackage";

describe("AptosExtensionsPackage", () => {
  let aptos: Aptos;
  let deployer: Ed25519Account;
  let aptosExtensionsPackageId: string;
  let aptosExtensionsPackage: AptosExtensionsPackage;
  let stablecoinPackageId: string;
  let stablecoinAddress: string;

  before(async () => {
    aptos = getAptosClient();

    const aptosExtensionsDeployer = await generateKeypair({ prefund: true });
    [aptosExtensionsPackageId] = await publishPackageToResourceAccount({
      aptos,
      deployer: aptosExtensionsDeployer,
      packageName: "aptos_extensions",
      seed: new Uint8Array(Buffer.from("aptos_extensions")),
      namedDeps: [
        {
          name: "deployer",
          address: aptosExtensionsDeployer.accountAddress.toString()
        }
      ],
      verifySource: false
    });

    aptosExtensionsPackage = new AptosExtensionsPackage(
      aptos,
      aptosExtensionsPackageId
    );
  });

  beforeEach(async () => {
    deployer = await generateKeypair({ prefund: true });

    [stablecoinPackageId] = await publishPackageToResourceAccount({
      aptos,
      deployer,
      packageName: "stablecoin",
      seed: new Uint8Array(Buffer.from("stablecoin")),
      namedDeps: [
        { name: "aptos_extensions", address: aptosExtensionsPackageId },
        {
          name: "deployer",
          address: deployer.accountAddress.toString()
        }
      ],
      verifySource: false
    });

    stablecoinAddress = await new StablecoinPackage(
      aptos,
      stablecoinPackageId
    ).stablecoin.stablecoinAddress();
  });

  describe("Upgradable", () => {
    describe("upgradePackage", () => {
      it("should upgrade stablecoin package successfully", async () => {
        const { metadataBytes, bytecode } = await buildPackage(
          "stablecoin",
          [
            { name: "aptos_extensions", address: aptosExtensionsPackageId },
            { name: "stablecoin", address: stablecoinPackageId },
            {
              name: "deployer",
              address: deployer.accountAddress.toString()
            }
          ],
          false
        );

        await aptosExtensionsPackage.upgradable.upgradePackage(
          deployer,
          stablecoinPackageId,
          metadataBytes,
          bytecode
        );
      });
    });
  });

  describe("Manageable", () => {
    describe("two step admin transfer", async () => {
      it("should succeed", async () => {
        const newAdmin = await generateKeypair({ prefund: true });

        await aptosExtensionsPackage.manageable.changeAdmin(
          deployer,
          stablecoinPackageId,
          newAdmin.accountAddress
        );

        assert.strictEqual(
          await aptosExtensionsPackage.manageable.pendingAdmin(
            stablecoinPackageId
          ),
          newAdmin.accountAddress.toString()
        );

        await aptosExtensionsPackage.manageable.acceptAdmin(
          newAdmin,
          stablecoinPackageId
        );

        assert.strictEqual(
          await aptosExtensionsPackage.manageable.admin(stablecoinPackageId),
          newAdmin.accountAddress.toString()
        );
      });
    });
  });

  describe("Ownable", () => {
    describe("two step ownership transfer", async () => {
      it("should succeed", async () => {
        const newOwner = await generateKeypair({ prefund: true });

        await aptosExtensionsPackage.ownable.transferOwnership(
          deployer,
          stablecoinAddress,
          newOwner.accountAddress
        );

        assert.strictEqual(
          await aptosExtensionsPackage.ownable.pendingOwner(stablecoinAddress),
          newOwner.accountAddress.toString()
        );

        await aptosExtensionsPackage.ownable.acceptOwnership(
          newOwner,
          stablecoinAddress
        );

        assert.strictEqual(
          await aptosExtensionsPackage.ownable.owner(stablecoinAddress),
          newOwner.accountAddress.toString()
        );
      });
    });
  });

  describe("Pausable", () => {
    describe("isPaused", async () => {
      it("should succeed", async () => {
        assert.strictEqual(
          await aptosExtensionsPackage.pausable.isPaused(stablecoinAddress),
          false
        );
      });
    });

    describe("updatePauser", async () => {
      it("should succeed", async () => {
        const newPauser = await generateKeypair({ prefund: false });

        await aptosExtensionsPackage.pausable.updatePauser(
          deployer,
          stablecoinAddress,
          newPauser.accountAddress
        );

        assert.strictEqual(
          await aptosExtensionsPackage.pausable.pauser(stablecoinAddress),
          newPauser.accountAddress.toString()
        );
      });
    });
  });
});
