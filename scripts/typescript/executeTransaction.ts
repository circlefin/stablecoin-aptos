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
  AccountAuthenticator,
  AccountAuthenticatorEd25519,
  AccountAuthenticatorMultiKey,
  Deserializer,
  Ed25519PublicKey,
  Ed25519Signature,
  Hex,
  MultiKey,
  MultiKeySignature,
  PublicKey,
  SimpleTransaction
} from "@aptos-labs/ts-sdk";
import { program } from "commander";
import { inspect } from "util";
import { getAptosClient } from "./utils";

export default program
  .createCommand("execute-transaction")
  .description("Executes a transaction")
  .requiredOption("-r, --rpc-url <string>", "Network RPC URL")
  .requiredOption(
    "--tx-bytes <string>",
    "Hex-encoded, BCS-serialized transaction"
  )
  .requiredOption(
    "--public-key <string>",
    "Hex-encoded, BCS-serialized public key for the sender of the transaction. Multi-sig accounts must have the keys serialized as a MultiKey."
  )
  .option(
    "--signature <string>",
    "Hex-encoded, BCS-serialized signature. Multi-sig accounts must have the signatures serialized as a MultiKeySignature. Required if --dry-run is unset"
  )
  .option("--multi-sig", "Use multi-sig mode for the transaction sender if set")
  .option("--dry-run", "Dry runs the transaction if set")
  .action(async (options) => {
    await executeTransaction(options);
  });

export async function executeTransaction({
  rpcUrl,
  txBytes,
  publicKey,
  signature,
  multiSig,
  dryRun
}: {
  rpcUrl: string;
  txBytes: string;
  publicKey: string;
  signature?: string;
  multiSig?: boolean;
  dryRun?: boolean;
}) {
  const aptos = getAptosClient(rpcUrl);

  const transaction = SimpleTransaction.deserialize(
    new Deserializer(Hex.fromHexString(txBytes).toUint8Array())
  );

  let signerPublicKey: PublicKey;
  if (multiSig) {
    signerPublicKey = MultiKey.deserialize(
      new Deserializer(Hex.fromHexString(publicKey).toUint8Array())
    );
  } else {
    signerPublicKey = Ed25519PublicKey.deserialize(
      new Deserializer(Hex.fromHexString(publicKey).toUint8Array())
    );
  }

  if (dryRun) {
    console.log("Dry running transaction...");

    const result = await aptos.transaction.simulate.simple({
      transaction,
      signerPublicKey
    });

    console.log(inspect(result, false, 8, true));
    return result;
  } else {
    console.log("Executing transaction...");

    if (signature == null) {
      throw new Error("Missing required signature for transaction execution!");
    }

    let senderAuthenticator: AccountAuthenticator;

    if (multiSig) {
      senderAuthenticator = new AccountAuthenticatorMultiKey(
        signerPublicKey as MultiKey,
        MultiKeySignature.deserialize(
          new Deserializer(Hex.fromHexString(signature).toUint8Array())
        )
      );
    } else {
      senderAuthenticator = new AccountAuthenticatorEd25519(
        signerPublicKey as Ed25519PublicKey,
        Ed25519Signature.deserialize(
          new Deserializer(Hex.fromHexString(signature).toUint8Array())
        )
      );
    }

    const initialTxOutput = await aptos.transaction.submit.simple({
      transaction,
      senderAuthenticator
    });

    const result = await aptos.waitForTransaction({
      transactionHash: initialTxOutput.hash
    });

    console.log(inspect(result, false, 8, true));
    return result;
  }
}
