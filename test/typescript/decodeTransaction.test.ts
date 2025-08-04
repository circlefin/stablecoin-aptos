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
  Ed25519Account,
  MoveFunctionId,
  MoveVector,
  TransactionPayloadEntryFunction
} from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import { randomBytes } from "crypto";
import fs from "fs";
import sinon, { SinonStub } from "sinon";
import { decodeTransaction } from "../../scripts/typescript/decodeTransaction";
import { deployAndInitializeToken } from "../../scripts/typescript/deployAndInitializeToken";
import { generateKeypair } from "../../scripts/typescript/generateKeypair";
import { getAptosClient, LOCAL_RPC_URL } from "../../scripts/typescript/utils";
import { TokenConfig } from "../../scripts/typescript/utils/tokenConfig";

describe("decodeTransaction", () => {
  const DECODED_TX_OUTPUT_FILEPATH = "path/to/decoded_transaction.json";

  const aptos = getAptosClient(LOCAL_RPC_URL);

  let deployer: Ed25519Account;
  let aptosExtensionsPackageId: string;
  let stablecoinPackageId: string;

  let writeFileSyncStub: SinonStub;

  before(async () => {
    deployer = await generateKeypair({ prefund: true });
    const tokenConfig: TokenConfig = {
      name: "USDC",
      symbol: "USDC",
      decimals: 6,
      iconUri: "https://circle.com/usdc-icon",
      projectUri: "https://circle.com/usdc",

      admin: deployer.accountAddress.toString(),
      blocklister: deployer.accountAddress.toString(),
      masterMinter: deployer.accountAddress.toString(),
      metadataUpdater: deployer.accountAddress.toString(),
      owner: deployer.accountAddress.toString(),
      pauser: deployer.accountAddress.toString(),
      controllers: {},
      minters: {}
    };

    const testTokenConfigPath = "path/to/token_config.json";

    // Temporarily stub the fs methods for the deploy script.
    const existsSyncStub = sinon.stub(fs, "existsSync");
    existsSyncStub.callThrough();
    existsSyncStub.withArgs(testTokenConfigPath).returns(true);

    const readFileSyncStub = sinon.stub(fs, "readFileSync");
    readFileSyncStub.callThrough();
    readFileSyncStub
      .withArgs(testTokenConfigPath)
      .returns(JSON.stringify(tokenConfig));

    ({ aptosExtensionsPackageId, stablecoinPackageId } =
      await deployAndInitializeToken({
        deployerKey: deployer.privateKey.toString(),
        rpcUrl: LOCAL_RPC_URL,
        verifySource: true,
        tokenConfigPath: testTokenConfigPath
      }));

    sinon.restore();
  });

  beforeEach(() => {
    writeFileSyncStub = sinon.stub(fs, "writeFileSync");
  });

  afterEach(() => {
    sinon.restore();
  });

  async function fixture(feePayer?: Ed25519Account) {
    const txInputs = {
      functionTarget:
        `${aptosExtensionsPackageId}::upgradable::upgrade_package` as MoveFunctionId,
      rawFunctionArguments: [
        // resource_acct: address,
        stablecoinPackageId,
        // metadata_serialized: vector<u8>,
        `0x${randomBytes(100).toString("hex")}`,
        // code: vector<vector<u8>>
        [
          `0x${randomBytes(100).toString("hex")}`,
          `0x${randomBytes(100).toString("hex")}`,
          `0x${randomBytes(100).toString("hex")}`,
          `0x${randomBytes(100).toString("hex")}`,
          `0x${randomBytes(100).toString("hex")}`
        ]
      ] as [string, string, string[]],

      gasUnitPrice: 500,
      maxGasAmount: 1_000_000,
      sequenceNumber: 20,
      expireTimestamp: Date.now(),

      sender: deployer,
      feePayer
    };

    // Build the transaction based on the inputs.
    const transaction = await aptos.transaction.build.simple({
      data: {
        function: txInputs.functionTarget,
        functionArguments: [
          AccountAddress.fromStrict(txInputs.rawFunctionArguments[0]),
          MoveVector.U8(txInputs.rawFunctionArguments[1]),
          new MoveVector(txInputs.rawFunctionArguments[2].map(MoveVector.U8))
        ]
      },
      sender: txInputs.sender.accountAddress,
      options: {
        gasUnitPrice: txInputs.gasUnitPrice,
        maxGasAmount: txInputs.maxGasAmount,
        accountSequenceNumber: txInputs.sequenceNumber,
        expireTimestamp: txInputs.expireTimestamp
      },
      withFeePayer: txInputs.feePayer != null
    });

    // Simulate signing the transaction, as the TS SDK manipulates the
    // transaction when signing. Discard the signatures
    // since it is not necessary for the test.
    aptos.transaction.sign({
      signer: txInputs.sender,
      transaction
    });

    if (txInputs.feePayer) {
      aptos.transaction.signAsFeePayer({
        signer: txInputs.feePayer,
        transaction
      });
    }

    const txBytes = transaction.bcsToHex().toString();

    const rawTxPayloadArgs = (
      transaction.rawTransaction.payload as TransactionPayloadEntryFunction
    ).entryFunction.args;

    return {
      txInputs,
      txBytes,
      rawTxPayloadArgs,
      chainId: await aptos.getChainId()
    };
  }

  it("should successfully decode a transaction and its payload's arguments", async () => {
    const functionName = "upgradePackage";
    const { txInputs, txBytes, chainId } = await fixture();

    await decodeTransaction({
      txBytes,
      output: DECODED_TX_OUTPUT_FILEPATH,
      functionName
    });

    sinon.assert.calledOnce(writeFileSyncStub);

    const decodedTx = JSON.parse(writeFileSyncStub.getCall(0).args[1]);
    assert.deepEqual(decodedTx, {
      sender: txInputs.sender.accountAddress.toString(),
      sequenceNumber: txInputs.sequenceNumber.toString(),
      maxGasAmount: txInputs.maxGasAmount.toString(),
      gasUnitPrice: txInputs.gasUnitPrice.toString(),
      expirationTimestampSecs: txInputs.expireTimestamp.toString(),
      chainId: chainId.toString(),
      payload: {
        function: txInputs.functionTarget,
        typeArgs: [],
        args: txInputs.rawFunctionArguments
      }
    });
  });

  it("should successfully decode a transaction with fee payer", async () => {
    const functionName = "upgradePackage";
    const feePayer = await generateKeypair({ prefund: true });
    const { txInputs, txBytes, chainId } = await fixture(feePayer);

    await decodeTransaction({
      txBytes,
      output: DECODED_TX_OUTPUT_FILEPATH,
      functionName
    });

    sinon.assert.calledOnce(writeFileSyncStub);

    const decodedTx = JSON.parse(writeFileSyncStub.getCall(0).args[1]);
    assert.deepEqual(decodedTx, {
      sender: txInputs.sender.accountAddress.toString(),
      feePayer: feePayer.accountAddress.toString(),
      sequenceNumber: txInputs.sequenceNumber.toString(),
      maxGasAmount: txInputs.maxGasAmount.toString(),
      gasUnitPrice: txInputs.gasUnitPrice.toString(),
      expirationTimestampSecs: txInputs.expireTimestamp.toString(),
      chainId: chainId.toString(),
      payload: {
        function: txInputs.functionTarget,
        typeArgs: [],
        args: txInputs.rawFunctionArguments
      }
    });
  });

  it("should successfully decode a transaction with no argument decoder support", async () => {
    const { txInputs, txBytes, rawTxPayloadArgs, chainId } = await fixture();

    await decodeTransaction({
      txBytes,
      output: DECODED_TX_OUTPUT_FILEPATH
    });

    sinon.assert.calledOnce(writeFileSyncStub);

    const decodedTx = JSON.parse(writeFileSyncStub.getCall(0).args[1]);
    assert.deepEqual(decodedTx, {
      sender: txInputs.sender.accountAddress.toString(),
      sequenceNumber: txInputs.sequenceNumber.toString(),
      maxGasAmount: txInputs.maxGasAmount.toString(),
      gasUnitPrice: txInputs.gasUnitPrice.toString(),
      expirationTimestampSecs: txInputs.expireTimestamp.toString(),
      chainId: chainId.toString(),
      payload: {
        function: txInputs.functionTarget,
        typeArgs: [],
        args: rawTxPayloadArgs.map((arg) => arg.bcsToHex().toString())
      }
    });
  });
});
