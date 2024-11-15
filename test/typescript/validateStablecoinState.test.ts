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
import fs from "fs";
import sinon, { SinonStub } from "sinon";
import { deployAndInitializeToken } from "../../scripts/typescript/deployAndInitializeToken";
import { generateKeypair } from "../../scripts/typescript/generateKeypair";
import {
  getAptosClient,
  LOCAL_RPC_URL,
  normalizeAddress
} from "../../scripts/typescript/utils";
import { TokenConfig } from "../../scripts/typescript/utils/tokenConfig";
import {
  validateStablecoinState,
  ConfigFile as ValidateStablecoinStateConfigFile
} from "../../scripts/typescript/validateStablecoinState";
import { generateKeypairs } from "./testUtils";
import { Ed25519Account } from "@aptos-labs/ts-sdk";
import { StablecoinPackage } from "../../scripts/typescript/packages/stablecoinPackage";

type DeploymentInfo = {
  deployer: Ed25519Account;
  packages: Awaited<ReturnType<typeof deployAndInitializeToken>>;
};

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

describe("validateStablecoinState", () => {
  const TEST_TOKEN_CONFIG_PATH = "path/to/token_config.json";
  const TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH =
    "path/to/validate_stablecoin_state_config.json";

  const aptos = getAptosClient(LOCAL_RPC_URL);

  let readFileSyncStub: SinonStub;
  let tokenConfig: TokenConfig;

  let admin: Ed25519Account;
  let blocklister: Ed25519Account;
  let masterMinter: Ed25519Account;
  let metadataUpdater: Ed25519Account;
  let owner: Ed25519Account;
  let pauser: Ed25519Account;
  let controller: Ed25519Account;
  let minter: Ed25519Account;

  let sourceCodeVerifiedPackages: DeploymentInfo;
  let sourceCodeUnverifiedPackages: DeploymentInfo;
  let stablecoinPackage: StablecoinPackage;

  before(async () => {
    const existsSyncStub = sinon.stub(fs, "existsSync");
    existsSyncStub.returns(true);

    [blocklister] = await generateKeypairs(1, true);

    [admin, masterMinter, metadataUpdater, owner, pauser, controller, minter] =
      await generateKeypairs(7, false);

    tokenConfig = {
      name: "USDC",
      symbol: "USDC",
      decimals: 6,
      iconUri: "https://circle.com/usdc-icon",
      projectUri: "https://circle.com/usdc",

      admin: admin.accountAddress.toString(),
      blocklister: blocklister.accountAddress.toString(),
      masterMinter: masterMinter.accountAddress.toString(),
      metadataUpdater: metadataUpdater.accountAddress.toString(),
      owner: owner.accountAddress.toString(),
      pauser: pauser.accountAddress.toString(),

      controllers: {
        [controller.accountAddress.toString()]: minter.accountAddress.toString()
      },
      minters: {
        [minter.accountAddress.toString()]: "1000000000"
      }
    };

    readFileSyncStub = sinon.stub(fs, "readFileSync");
    readFileSyncStub.callThrough();
    readFileSyncStub
      .withArgs(TEST_TOKEN_CONFIG_PATH)
      .returns(JSON.stringify(tokenConfig));

    const verifiedPackagesDeployer = await generateKeypair({ prefund: true });
    sourceCodeVerifiedPackages = {
      deployer: verifiedPackagesDeployer,
      packages: await deployAndInitializeToken({
        deployerKey: verifiedPackagesDeployer.privateKey.toString(),
        rpcUrl: LOCAL_RPC_URL,
        verifySource: true,
        tokenConfigPath: TEST_TOKEN_CONFIG_PATH
      })
    };

    const unverifiedPackagesDeployer = await generateKeypair({ prefund: true });
    sourceCodeUnverifiedPackages = {
      deployer: unverifiedPackagesDeployer,
      packages: await deployAndInitializeToken({
        deployerKey: unverifiedPackagesDeployer.privateKey.toString(),
        rpcUrl: LOCAL_RPC_URL,
        verifySource: false,
        tokenConfigPath: TEST_TOKEN_CONFIG_PATH
      })
    };

    stablecoinPackage = new StablecoinPackage(
      aptos,
      sourceCodeUnverifiedPackages.packages.stablecoinPackageId
    );
  });

  beforeEach(async () => {
    readFileSyncStub.restore();
    readFileSyncStub = sinon.stub(fs, "readFileSync");
  });

  after(() => {
    sinon.restore();
  });

  async function setup(
    deploymentInfo: DeploymentInfo,
    configOverrides: DeepPartial<ValidateStablecoinStateConfigFile>
  ) {
    const baseValidateStablecoinStateConfig: ValidateStablecoinStateConfigFile =
      {
        aptosExtensionsPackageId:
          deploymentInfo.packages.aptosExtensionsPackageId,
        stablecoinPackageId: deploymentInfo.packages.stablecoinPackageId,
        expectedStates: {
          aptosExtensionsPackage: {
            upgradeNumber: 0,
            upgradePolicy: "immutable",
            sourceCodeExists: false
          },
          stablecoinPackage: {
            upgradeNumber: 0,
            upgradePolicy: "compatible",
            sourceCodeExists: false
          },

          name: tokenConfig.name,
          symbol: tokenConfig.symbol,
          decimals: tokenConfig.decimals,
          iconUri: tokenConfig.iconUri,
          projectUri: tokenConfig.projectUri,
          paused: false,
          initializedVersion: 1,
          totalSupply: "0",

          admin: normalizeAddress(
            deploymentInfo.deployer.accountAddress.toString()
          ),
          blocklister: tokenConfig.blocklister,
          masterMinter: tokenConfig.masterMinter,
          metadataUpdater: tokenConfig.metadataUpdater,
          owner: normalizeAddress(
            deploymentInfo.deployer.accountAddress.toString()
          ),
          pauser: tokenConfig.pauser,
          pendingAdmin: tokenConfig.admin,
          pendingOwner: tokenConfig.owner,

          controllers: tokenConfig.controllers,
          minters: tokenConfig.minters,
          blocklist: []
        }
      };

    const overriddenConfig = {
      ...baseValidateStablecoinStateConfig,
      ...configOverrides,
      expectedStates: {
        ...baseValidateStablecoinStateConfig.expectedStates,
        ...(configOverrides.expectedStates ?? {}),
        aptosExtensionsPackage: {
          ...baseValidateStablecoinStateConfig.expectedStates
            .aptosExtensionsPackage,
          ...(configOverrides.expectedStates?.aptosExtensionsPackage ?? {})
        },
        stablecoinPackage: {
          ...baseValidateStablecoinStateConfig.expectedStates.stablecoinPackage,
          ...(configOverrides.expectedStates?.stablecoinPackage ?? {})
        },
        controllers:
          configOverrides.expectedStates?.controllers ??
          baseValidateStablecoinStateConfig.expectedStates.controllers,
        minters:
          configOverrides.expectedStates?.minters ??
          baseValidateStablecoinStateConfig.expectedStates.minters,
        blocklist: configOverrides.expectedStates?.blocklist ?? []
      }
    };

    readFileSyncStub
      .withArgs(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH)
      .returns(JSON.stringify(overriddenConfig));
  }

  it("should succeed if all states matches", async () => {
    await setup(sourceCodeUnverifiedPackages, {});
    await validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
      rpcUrl: LOCAL_RPC_URL
    });
  });

  it("should succeed if all states matches", async () => {
    await setup(sourceCodeVerifiedPackages, {
      expectedStates: {
        aptosExtensionsPackage: { sourceCodeExists: true },
        stablecoinPackage: { sourceCodeExists: true }
      }
    });
    await validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
      rpcUrl: LOCAL_RPC_URL
    });
  });

  const expectedStatesTestCases: [
    string,
    DeepPartial<ValidateStablecoinStateConfigFile["expectedStates"]>
  ][] = [
    [
      "should fail if aptosExtensionsPackage metadata is mismatched",
      { aptosExtensionsPackage: { sourceCodeExists: true } }
    ],
    [
      "should fail if stablecoinPackage metadata is mismatched",
      { stablecoinPackage: { sourceCodeExists: true } }
    ],
    ["should fail if name is mismatched", { name: "name" }],
    ["should fail if symbol is mismatched", { symbol: "symbol" }],
    ["should fail if decimals is mismatched", { decimals: 0 }],
    ["should fail if iconUri is mismatched", { iconUri: "http://iconUri.com" }],
    [
      "should fail if projectUri is mismatched",
      { projectUri: "http://projectUri.com" }
    ],
    ["should fail if paused is mismatched", { paused: true }],
    [
      "should fail if initializedVersion is mismatched",
      { initializedVersion: 0 }
    ],
    ["should fail if admin is mismatched", { admin: normalizeAddress("0x1") }],
    [
      "should fail if blocklister is mismatched",
      { blocklister: normalizeAddress("0x1") }
    ],
    [
      "should fail if masterMinter is mismatched",
      { masterMinter: normalizeAddress("0x1") }
    ],
    [
      "should fail if metadataUpdater is mismatched",
      { metadataUpdater: normalizeAddress("0x1") }
    ],
    ["should fail if owner is mismatched", { owner: normalizeAddress("0x1") }],
    [
      "should fail if pauser is mismatched",
      { pauser: normalizeAddress("0x1") }
    ],
    [
      "should fail if pendingOwner is mismatched",
      { pendingOwner: normalizeAddress("0x1") }
    ],
    [
      "should fail if pendingAdmin is mismatched",
      { pendingAdmin: normalizeAddress("0x1") }
    ],
    ["should fail if totalSupply is mismatched", { totalSupply: "999" }]
  ];

  for (const [title, expectedStatesOverride] of expectedStatesTestCases) {
    it(title, async () => {
      await setup(sourceCodeUnverifiedPackages, {
        expectedStates: expectedStatesOverride
      });
      await assert.rejects(
        validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
          rpcUrl: LOCAL_RPC_URL
        }),
        /AssertionError.*: Expected values to be strictly deep-equal/
      );
    });
  }

  it("should fail if a controller is unconfigured", async () => {
    await setup(sourceCodeUnverifiedPackages, {
      expectedStates: {
        controllers: { [normalizeAddress("0x1")]: normalizeAddress("0x2") }
      }
    });
    await assert.rejects(
      validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
        rpcUrl: LOCAL_RPC_URL
      }),
      /Invalid controller configuration/
    );
  });

  it("should fail if a controller is misconfigured", async () => {
    const currentController = Object.keys(tokenConfig.controllers)[0];

    await setup(sourceCodeUnverifiedPackages, {
      expectedStates: {
        controllers: { [currentController]: normalizeAddress("0x2") }
      }
    });
    await assert.rejects(
      validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
        rpcUrl: LOCAL_RPC_URL
      }),
      /Invalid controller configuration/
    );
  });

  it("should fail if additional controllers are configured", async () => {
    await setup(sourceCodeUnverifiedPackages, {
      expectedStates: {
        controllers: {}
      }
    });
    await assert.rejects(
      validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
        rpcUrl: LOCAL_RPC_URL
      }),
      /Additional controllers configured/
    );
  });

  it("should fail if a minter is unconfigured", async () => {
    await setup(sourceCodeUnverifiedPackages, {
      expectedStates: {
        minters: { [normalizeAddress("0x1")]: "1000" }
      }
    });
    await assert.rejects(
      validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
        rpcUrl: LOCAL_RPC_URL
      }),
      /Invalid minter configuration/
    );
  });

  it("should fail if a minter is misconfigured", async () => {
    const currentMinter = Object.keys(tokenConfig.minters)[0];

    await setup(sourceCodeUnverifiedPackages, {
      expectedStates: {
        minters: { [currentMinter]: "1000" }
      }
    });
    await assert.rejects(
      validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
        rpcUrl: LOCAL_RPC_URL
      }),
      /Invalid minter configuration/
    );
  });

  it("should fail if additional minters are configured", async () => {
    await setup(sourceCodeUnverifiedPackages, {
      expectedStates: {
        minters: {}
      }
    });
    await assert.rejects(
      validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
        rpcUrl: LOCAL_RPC_URL
      }),
      /Additional minters configured/
    );
  });

  it("should fail if an address is not blocklisted", async () => {
    await setup(sourceCodeUnverifiedPackages, {
      expectedStates: {
        blocklist: [normalizeAddress("0x1")]
      }
    });
    await assert.rejects(
      validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
        rpcUrl: LOCAL_RPC_URL
      }),
      /Invalid blocklist configuration/
    );
  });

  it("should fail if additional addresses are blocklisted", async () => {
    await setup(sourceCodeUnverifiedPackages, {});

    const addressToBlock = normalizeAddress("0x111");
    await stablecoinPackage.blocklistable.blocklist(
      blocklister,
      addressToBlock
    );

    await assert.rejects(
      validateStablecoinState(TEST_VALIDATE_STABLECOIN_STATE_CONFIG_PATH, {
        rpcUrl: LOCAL_RPC_URL
      }),
      /Additional addresses blocklisted/
    );
    // Reset blocklisted address
    await stablecoinPackage.blocklistable.unblocklist(
      blocklister,
      addressToBlock
    );
  });
});
