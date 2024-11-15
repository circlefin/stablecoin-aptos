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

import { Account, Aptos, AptosApiType } from "@aptos-labs/ts-sdk";
import { program } from "commander";
import { getAptosClient } from "./utils";

export default program
  .createCommand("generate-keypair")
  .description("Generate a new Aptos keypair")
  .option("--prefund", "Fund generated signer with some test Aptos token")
  .option(
    "-r, --rpc-url <string>",
    "Network RPC URL, required when prefund is enabled"
  )
  .option(
    "--faucet-url <string>",
    "Faucet URL, required when prefund is enabled"
  )
  .action(async (options) => {
    const keypair = await generateKeypair(options);
    console.log("Account address:", keypair.accountAddress.toString());
    console.log("Public key:", keypair.publicKey.toString());
    console.log("Secret key:", keypair.privateKey.toString());
  });

export async function generateKeypair(options: {
  rpcUrl?: string;
  faucetUrl?: string;
  prefund?: boolean;
}) {
  const keypair = Account.generate();

  if (options.prefund) {
    let aptos: Aptos;

    if (!options.rpcUrl || !options.faucetUrl) {
      console.log("Defaulting to local environment...");
      aptos = getAptosClient();
    } else {
      aptos = getAptosClient(options.rpcUrl, options.faucetUrl);
    }

    console.log(
      `Requesting test tokens from ${aptos.config.getRequestUrl(AptosApiType.FAUCET)}...`
    );

    await aptos.fundAccount({
      accountAddress: keypair.accountAddress,
      amount: 10 * 10 ** 8, // Max. 10 APT, actual amount received depends on the environment.
      options: { waitForIndexer: false }
    });

    const accountBalance = await aptos.getAccountAPTAmount({
      accountAddress: keypair.accountAddress
    });

    console.log(
      `Funded address ${keypair.accountAddress.toString()} with ${accountBalance / 10 ** 8} APT`
    );
  }

  return keypair;
}
