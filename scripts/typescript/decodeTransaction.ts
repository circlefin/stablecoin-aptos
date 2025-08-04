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
  Deserializable,
  Deserializer,
  EntryFunctionArgument,
  EntryFunctionBytes,
  FixedBytes,
  Hex,
  MoveVector,
  Serializable,
  SimpleTransaction,
  TransactionPayloadEntryFunction,
  U8
} from "@aptos-labs/ts-sdk";
import { program } from "commander";
import fs from "fs";
import path from "path";
import { REPOSITORY_ROOT } from "./utils";

export default program
  .createCommand("decode-transaction")
  .description("Decodes transaction bytes into a human-readable format.")
  .requiredOption(
    "--tx-bytes <string>",
    "Hex-encoded, BCS-serialized transaction"
  )
  .requiredOption("-o, --output <string>", "The output file path.")
  .option(
    "--function-name <string>",
    "The name of the function that is being decoded. Required for argument decoding."
  )
  .action(async (options) => {
    await decodeTransaction(options);
  });

export async function decodeTransaction({
  txBytes,
  output,
  functionName
}: {
  txBytes: string;
  output: string;
  functionName?: string;
}) {
  // Deserialize the transaction bytes into a SimpleTransaction.
  const tx = SimpleTransaction.deserialize(
    new Deserializer(Hex.fromHexString(txBytes).toUint8Array())
  );

  if (!(tx.rawTransaction.payload instanceof TransactionPayloadEntryFunction)) {
    throw new Error(
      "Only transactions with entry function payloads are supported."
    );
  }

  const txPayload = tx.rawTransaction.payload.entryFunction;

  // Attempt to decode the arguments for the function.
  const txPayloadArguments = txPayload.args as EntryFunctionBytes[];
  const isArgDecoderSupportedForFunction =
    functionName != null &&
    Object.keys(argumentDecoders).includes(functionName);

  if (!isArgDecoderSupportedForFunction) {
    console.log(
      `NOTE: Argument decoding is either disabled or is unsupported for the entry function called. The decoded transaction will return the arguments as its raw BCS-serialized bytes.`
    );
  }

  const args = isArgDecoderSupportedForFunction
    ? txPayloadArguments.map((arg, i) =>
        argumentDecoders[functionName][i](arg.value)
      )
    : txPayloadArguments.map((arg) => arg.bcsToHex().toString());

  // Decode the transaction.
  const decodedTx = {
    sender: tx.rawTransaction.sender.toString(),
    sequenceNumber: tx.rawTransaction.sequence_number.toString(),
    maxGasAmount: tx.rawTransaction.max_gas_amount.toString(),
    gasUnitPrice: tx.rawTransaction.gas_unit_price.toString(),
    expirationTimestampSecs:
      tx.rawTransaction.expiration_timestamp_secs.toString(),
    chainId: tx.rawTransaction.chain_id.chainId.toString(),
    feePayer: tx.feePayerAddress?.toString(),
    payload: {
      function: `${txPayload.module_name.address.toString()}::${txPayload.module_name.name.identifier}::${txPayload.function_name.identifier}`,
      typeArgs: txPayload.type_args.map((tyArg) => tyArg.toString()),
      args
    }
  };

  // Write the decoded transaction to a file.
  const outputFilePath = path.join(REPOSITORY_ROOT, output);
  console.log(
    `\u001b[32mTransaction successfully decoded and saved to: '${outputFilePath}'\u001b[0m`
  );
  fs.writeFileSync(outputFilePath, JSON.stringify(decodedTx, null, 2));
}

// ==== Argument Decoders ====
const argumentDecoders: Record<string, ((arg: FixedBytes) => any)[]> = {
  // aptos_extensions::upgradable::upgrade_package
  upgradePackage: [
    // resource_acct: address,
    (arg: FixedBytes) =>
      AccountAddress.deserialize(new Deserializer(arg.value)).toString(),

    // metadata_serialized: vector<u8>,
    (arg: FixedBytes) => {
      const vector = MoveVector.deserialize(new Deserializer(arg.value), U8);
      return convertMoveVectorU8ToHex(vector);
    },

    // code: vector<vector<u8>>
    (arg: FixedBytes) => {
      const vector = TwoLevelMoveVector.deserialize(
        new Deserializer(arg.value),
        U8
      );
      return vector.values.map(convertMoveVectorU8ToHex);
    }
  ]
};

/**
 * Referenced from {@link https://github.com/aptos-labs/aptos-ts-sdk/blob/34539a96eb51c2605f759ec3615624a8489988e9/src/bcs/serializable/moveStructs.ts#L289-L319}
 */
class TwoLevelMoveVector {
  static deserialize<T extends Serializable & EntryFunctionArgument>(
    deserializer: Deserializer,
    cls: Deserializable<T>
  ): MoveVector<MoveVector<T>> {
    const length = deserializer.deserializeUleb128AsU32();
    const values: Array<MoveVector<T>> = [];
    for (let i = 0; i < length; i += 1) {
      values.push(MoveVector.deserialize(deserializer, cls));
    }
    return new MoveVector(values);
  }
}

/**
 * Converts a MoveVector<U8> into a hex string.
 *
 * @param moveVector - The MoveVector<U8> to convert.
 * @returns The hex string representation of the MoveVector<U8>.
 */
function convertMoveVectorU8ToHex(moveVector: MoveVector<U8>) {
  const byteArray = Uint8Array.from(moveVector.values.map((u8) => u8.value));
  return `0x${Buffer.from(byteArray).toString("hex")}`;
}
