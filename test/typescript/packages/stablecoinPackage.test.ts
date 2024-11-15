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
  Aptos,
  createObjectAddress,
  Ed25519Account
} from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import { generateKeypair } from "../../../scripts/typescript/generateKeypair";
import { StablecoinPackage } from "../../../scripts/typescript/packages/stablecoinPackage";
import {
  getAptosClient,
  normalizeAddress
} from "../../../scripts/typescript/utils";
import { publishPackageToResourceAccount } from "../../../scripts/typescript/utils/deployUtils";

describe("StablecoinPackage", () => {
  let aptos: Aptos;
  let deployer: Ed25519Account;
  let aptosExtensionsPackageId: string;
  let stablecoinPackageId: string;
  let stablecoinPackage: StablecoinPackage;

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

    stablecoinPackage = new StablecoinPackage(aptos, stablecoinPackageId);
  });

  describe("Stablecoin", () => {
    describe("stablecoinAddress", () => {
      it("should return the correct stablecoin address", async () => {
        assert.strictEqual(
          await stablecoinPackage.stablecoin.stablecoinAddress(),
          createObjectAddress(
            AccountAddress.fromStrict(stablecoinPackageId),
            new Uint8Array(Buffer.from("stablecoin"))
          ).toString()
        );
      });
    });

    describe("initializeV1", () => {
      it("should succeed", async () => {
        await stablecoinPackage.stablecoin.initializeV1(
          deployer,
          "name",
          "symbol",
          6,
          "icon_uri",
          "project_uri"
        );
      });
    });
  });

  describe("Treasury", () => {
    describe("E2E test", () => {
      it("should succeed", async () => {
        const masterMinter = await generateKeypair({ prefund: true });
        const controller = await generateKeypair({ prefund: true });
        const minter = await generateKeypair({ prefund: false });

        await stablecoinPackage.treasury.updateMasterMinter(
          deployer,
          masterMinter.accountAddress
        );

        assert.strictEqual(
          await stablecoinPackage.treasury.masterMinter(),
          masterMinter.accountAddress.toString()
        );

        await stablecoinPackage.treasury.configureController(
          masterMinter,
          controller.accountAddress,
          minter.accountAddress
        );

        const mintAllowance = BigInt(1_000_000);
        await stablecoinPackage.treasury.configureMinter(
          controller,
          mintAllowance
        );

        assert.strictEqual(
          await stablecoinPackage.treasury.getMinter(controller.accountAddress),
          minter.accountAddress.toString()
        );

        assert.strictEqual(
          await stablecoinPackage.treasury.isMinter(minter.accountAddress),
          true
        );

        assert.strictEqual(
          await stablecoinPackage.treasury.mintAllowance(minter.accountAddress),
          mintAllowance
        );

        await stablecoinPackage.treasury.removeMinter(controller);

        await stablecoinPackage.treasury.removeController(
          masterMinter,
          controller.accountAddress
        );
      });
    });
  });

  describe("Blocklistable", () => {
    describe("isBlocklisted", async () => {
      it("should return a boolean", async () => {
        assert.strictEqual(
          await stablecoinPackage.blocklistable.isBlocklisted(
            normalizeAddress("0x123")
          ),
          false
        );
      });
    });

    describe("updateBlocklister", async () => {
      it("should succeed", async () => {
        const newBlocklister = await generateKeypair({ prefund: false });

        await stablecoinPackage.blocklistable.updateBlocklister(
          deployer,
          newBlocklister.accountAddress
        );

        assert.strictEqual(
          await stablecoinPackage.blocklistable.blocklister(),
          newBlocklister.accountAddress.toString()
        );
      });
    });

    describe("blocklist and unblocklist", async () => {
      it("should succeed", async () => {
        const addressToBlock = normalizeAddress("0x123");

        await stablecoinPackage.blocklistable.blocklist(
          deployer,
          addressToBlock
        );

        assert.strictEqual(
          await stablecoinPackage.blocklistable.isBlocklisted(addressToBlock),
          true
        );

        await stablecoinPackage.blocklistable.unblocklist(
          deployer,
          addressToBlock
        );

        assert.strictEqual(
          await stablecoinPackage.blocklistable.isBlocklisted(addressToBlock),
          false
        );
      });
    });
  });

  describe("Metadata", () => {
    describe("updateMetadataUpdater", async () => {
      it("should succeed", async () => {
        const newMetadataUpdater = await generateKeypair({ prefund: false });

        await stablecoinPackage.metadata.updateMetadataUpdater(
          deployer,
          newMetadataUpdater.accountAddress
        );

        assert.strictEqual(
          await stablecoinPackage.metadata.metadataUpdater(),
          newMetadataUpdater.accountAddress.toString()
        );
      });
    });
  });
});
