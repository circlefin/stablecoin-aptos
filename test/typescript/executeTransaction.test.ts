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
  CommittedTransactionResponse,
  U64,
  UserTransactionResponse
} from "@aptos-labs/ts-sdk";
import { strict as assert } from "assert";
import { executeTransaction } from "../../scripts/typescript/executeTransaction";
import { generateKeypair } from "../../scripts/typescript/generateKeypair";
import {
  getAptosClient,
  LOCAL_FAUCET_URL,
  LOCAL_RPC_URL
} from "../../scripts/typescript/utils";
import { generateKOfNMultiKeyAccount } from "./testUtils";
import sinon, { SinonStub } from "sinon";
import { inspect } from "util";

describe("executeTransaction E2E test", () => {
  const aptos = getAptosClient(LOCAL_RPC_URL);

  let consoleLogStub: SinonStub;

  beforeEach(() => {
    consoleLogStub = sinon.stub(console, "log");
  });

  afterEach(() => {
    sinon.restore();
  });

  async function fixture(useMultiSigTxSender: boolean) {
    const multiSigAccount = await generateKOfNMultiKeyAccount(2, 3);
    await aptos.fundAccount({
      accountAddress: multiSigAccount.accountAddress,
      amount: 10 * 10 ** 8,
      options: { waitForIndexer: false }
    });

    const singleSigAccount = await generateKeypair({
      rpcUrl: LOCAL_RPC_URL,
      faucetUrl: LOCAL_FAUCET_URL,
      prefund: true
    });

    const sender = useMultiSigTxSender ? multiSigAccount : singleSigAccount;
    const recipient = useMultiSigTxSender ? singleSigAccount : multiSigAccount;

    const transaction = await aptos.transaction.build.simple({
      data: {
        function: "0x1::coin::transfer",
        typeArguments: ["0x1::aptos_coin::AptosCoin"],
        functionArguments: [recipient.accountAddress, new U64(1000)]
      },
      sender: sender.accountAddress
    });

    const hexEncodedTxBytes = transaction.bcsToHex().toString();
    const hexEncodedPublicKey = sender.publicKey.bcsToHex().toString();
    const hexEncodedSignature = sender
      .signTransaction(transaction)
      .bcsToHex()
      .toString();

    return {
      hexEncodedTxBytes,
      hexEncodedPublicKey,
      hexEncodedSignature
    };
  }

  it("should succeed when dry running a single-sig transaction", async () => {
    const useMultiSigTxSender = false;
    const dryRun = true;

    const { hexEncodedTxBytes, hexEncodedPublicKey } =
      await fixture(useMultiSigTxSender);
    const result = (await executeTransaction({
      rpcUrl: LOCAL_RPC_URL,
      txBytes: hexEncodedTxBytes,
      publicKey: hexEncodedPublicKey,
      dryRun,
      multiSig: useMultiSigTxSender
    })) as UserTransactionResponse[];

    assert.equal(result[0].success, true);
    await assert.rejects(
      () => aptos.getTransactionByHash({ transactionHash: result[0].hash }),
      /AptosApiError.*Transaction not found.*/
    );
    assert.equal(
      consoleLogStub.calledWith(inspect(result, false, 8, true)),
      true
    );
  });

  it("should succeed when dry running a multi-sig transaction", async () => {
    const useMultiSigTxSender = true;
    const dryRun = true;

    const { hexEncodedTxBytes, hexEncodedPublicKey } =
      await fixture(useMultiSigTxSender);
    const result = (await executeTransaction({
      rpcUrl: LOCAL_RPC_URL,
      txBytes: hexEncodedTxBytes,
      publicKey: hexEncodedPublicKey,
      dryRun,
      multiSig: useMultiSigTxSender
    })) as UserTransactionResponse[];

    assert.equal(result[0].success, true);
    await assert.rejects(
      () => aptos.getTransactionByHash({ transactionHash: result[0].hash }),
      /AptosApiError.*Transaction not found.*/
    );
    assert.equal(
      consoleLogStub.calledWith(inspect(result, false, 8, true)),
      true
    );
  });

  it("should succeed when executing a single-sig transaction", async () => {
    const useMultiSigTxSender = false;
    const dryRun = false;

    const { hexEncodedTxBytes, hexEncodedPublicKey, hexEncodedSignature } =
      await fixture(useMultiSigTxSender);

    const result = (await executeTransaction({
      rpcUrl: LOCAL_RPC_URL,
      txBytes: hexEncodedTxBytes,
      publicKey: hexEncodedPublicKey,
      signature: hexEncodedSignature,
      dryRun,
      multiSig: useMultiSigTxSender
    })) as CommittedTransactionResponse;

    assert.equal(result.success, true);
    assert(
      (await aptos.getTransactionByHash({ transactionHash: result.hash })) !=
        null
    );
    assert.equal(
      consoleLogStub.calledWith(inspect(result, false, 8, true)),
      true
    );
  });

  it("should succeed when executing a multi-sig transaction", async () => {
    const useMultiSigTxSender = true;
    const dryRun = false;

    const { hexEncodedTxBytes, hexEncodedPublicKey, hexEncodedSignature } =
      await fixture(useMultiSigTxSender);

    const result = (await executeTransaction({
      rpcUrl: LOCAL_RPC_URL,
      txBytes: hexEncodedTxBytes,
      publicKey: hexEncodedPublicKey,
      signature: hexEncodedSignature,
      dryRun,
      multiSig: useMultiSigTxSender
    })) as CommittedTransactionResponse;

    assert.equal(result.success, true);
    assert(
      (await aptos.getTransactionByHash({ transactionHash: result.hash })) !=
        null
    );
    assert.equal(
      consoleLogStub.calledWith(inspect(result, false, 8, true)),
      true
    );
  });
});
